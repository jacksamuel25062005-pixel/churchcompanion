// Resilient file upload queue.
//
// - Blob is stored directly inside IndexedDB (Dexie supports Blob).
// - Single in-process worker processes jobs sequentially.
// - Exponential backoff retries; pauses when offline; auto-resumes on
//   `online` event and Background Sync `cc-uploads` tag.

import { supabase } from "@/integrations/supabase/client";
import { log as logDiag } from "../../lib/diagnostics";
import { getDB, type UploadRow, type UploadStatus } from "../db";

type Listener = (jobs: UploadRow[]) => void;
const listeners = new Set<Listener>();
let cached: UploadRow[] = [];

async function refresh(): Promise<void> {
  try {
    cached = await getDB().uploads.orderBy("created_at").reverse().toArray();
    listeners.forEach((l) => { try { l(cached); } catch { /* */ } });
  } catch { /* */ }
}

export function subscribeUploads(l: Listener): () => void {
  listeners.add(l);
  l(cached);
  void refresh();
  return () => { listeners.delete(l); };
}
export function getUploadJobs(): UploadRow[] {
  return cached;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface EnqueueUploadInput {
  kind: string;
  blob: Blob;
  filename: string;
  mime?: string;
  bucket?: string;
  path?: string;
  meta?: Record<string, unknown>;
}

export async function enqueueUpload(input: EnqueueUploadInput): Promise<string> {
  const id = uuid();
  const now = Date.now();
  const row: UploadRow = {
    id,
    kind: input.kind,
    filename: input.filename,
    mime: input.mime ?? input.blob.type ?? "application/octet-stream",
    size: input.blob.size,
    blob: input.blob,
    bucket: input.bucket,
    path: input.path,
    meta: input.meta,
    status: "queued",
    progress: 0,
    retries: 0,
    created_at: now,
    updated_at: now,
  };
  await getDB().uploads.put(row);
  await refresh();
  void processQueue();
  // Also try to register a Background Sync tag so the SW can re-trigger.
  void registerBackgroundSync("cc-uploads");
  return id;
}

export async function removeUpload(id: string): Promise<void> {
  await getDB().uploads.delete(id);
  await refresh();
}
export async function retryUpload(id: string): Promise<void> {
  await getDB().uploads.update(id, { status: "queued", retries: 0, last_error: undefined, updated_at: Date.now() });
  await refresh();
  void processQueue();
}
async function setStatus(id: string, status: UploadStatus, patch: Partial<UploadRow> = {}): Promise<void> {
  await getDB().uploads.update(id, { status, updated_at: Date.now(), ...patch });
  await refresh();
}

const BACKOFF_MS = [1_000, 4_000, 15_000, 60_000, 5 * 60_000];
let processing = false;

export async function processQueue(): Promise<void> {
  if (processing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  processing = true;
  try {
    for (;;) {
      const next = await getDB().uploads
        .where("status").equals("queued")
        .first();
      if (!next) break;
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      await setStatus(next.id, "in-flight", { progress: 0 });
      try {
        await uploadJob(next);
        await setStatus(next.id, "completed", { progress: 1 });
      } catch (e) {
        const retries = next.retries + 1;
        const wait = BACKOFF_MS[Math.min(retries - 1, BACKOFF_MS.length - 1)];
        const msg = (e as Error)?.message ?? String(e);
        logDiag("warn", `upload ${next.filename} failed`, msg);
        if (retries >= BACKOFF_MS.length + 2) {
          await setStatus(next.id, "failed", { retries, last_error: msg });
        } else {
          await setStatus(next.id, "queued", { retries, last_error: msg });
          await sleep(wait);
        }
      }
    }
  } finally {
    processing = false;
  }
}

async function uploadJob(job: UploadRow): Promise<void> {
  if (!job.bucket || !job.path) {
    // No remote target — this job is a parser-only payload; the consumer
    // is expected to have already enqueued the parsed rows into the outbox.
    return;
  }
  const { error } = await supabase.storage
    .from(job.bucket)
    .upload(job.path, job.blob, {
      contentType: job.mime,
      upsert: true,
    });
  if (error) throw error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function registerBackgroundSync(tag: string): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } }).sync;
    if (sync && typeof sync.register === "function") {
      await sync.register(tag);
    }
  } catch { /* unsupported */ }
}
