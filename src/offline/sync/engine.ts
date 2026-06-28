// Offline-first sync engine.
//
// - PULL: calls public.sync_pull(since) via Supabase RPC, returns server
//   deltas for every syncable table + an authoritative server_time.
// - PUSH: drains the local outbox in batches, applying upserts/soft-deletes
//   against Supabase. Idempotent via the outbox row id.
// - LWW: server wins on equal/newer updated_at; locally-dirty rows that
//   haven't been pushed yet are preserved until their outbox op resolves.
//
// The engine is best-effort: any single network error backs off; the next
// trigger (online / focus / interval / route) tries again.

import { supabase } from "@/integrations/supabase/client";
import { logDiag } from "../../lib/diagnostics";
import {
  getDB,
  META_KEYS,
  metaGet,
  metaSet,
  type OutboxRow,
  type SyncTable,
} from "../db";

type Listener = (s: SyncState) => void;

export interface SyncState {
  status: "idle" | "syncing" | "error" | "offline";
  pending: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastRunAt: number | null;
}

const listeners = new Set<Listener>();
let state: SyncState = {
  status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "idle",
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  lastRunAt: null,
};

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => {
    try { l(state); } catch { /* ignore */ }
  });
}

export function getSyncState(): SyncState {
  return state;
}
export function subscribeSync(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => { listeners.delete(l); };
}

// ----------------- PULL -----------------

const PULL_TABLES: SyncTable[] = [
  "books",
  "songs",
  "book_sections",
  "today_song_sets",
  "today_song_items",
];

async function applyPullPayload(payload: Record<string, unknown>): Promise<void> {
  const db = getDB();
  await db.transaction(
    "rw",
    [db.books, db.songs, db.book_sections, db.today_song_sets, db.today_song_items],
    async () => {
      for (const t of PULL_TABLES) {
        const rows = (payload[t] as Array<Record<string, unknown> & { id: string; is_deleted?: boolean; updated_at?: string }> | undefined) ?? [];
        if (!rows.length) continue;
        const table = db.table(t);
        for (const row of rows) {
          const local = await table.get(row.id);
          if (local) {
            const localTs = (local as { updated_at?: string }).updated_at;
            const serverTs = row.updated_at;
            // LWW: keep newer
            if (localTs && serverTs && new Date(localTs).getTime() > new Date(serverTs).getTime()) {
              continue;
            }
          }
          if (row.is_deleted) {
            await table.delete(row.id);
          } else {
            await table.put(row);
          }
        }
      }
    },
  );
}

async function pullOnce(): Promise<void> {
  const since = (await metaGet<string>(META_KEYS.lastSyncedAt)) ?? null;
  const { data, error } = await supabase.rpc("sync_pull", { since });
  if (error) throw error;
  const payload = data as Record<string, unknown> & { server_time?: string };
  await applyPullPayload(payload);
  if (payload?.server_time) {
    await metaSet(META_KEYS.lastSyncedAt, payload.server_time);
    emit({ lastSyncedAt: payload.server_time });
  }
}

// ----------------- PUSH -----------------

const PUSH_BATCH = 50;
const BACKOFF_MS = [1_000, 4_000, 15_000, 60_000, 5 * 60_000];

async function applyOutboxRow(row: OutboxRow): Promise<void> {
  if (row.op === "delete") {
    // Soft-delete: mark is_deleted = true. Hard delete is reserved for admin.
    const { error } = await supabase
      .from(row.table as never)
      .update({ is_deleted: true } as never)
      .eq("id", row.row_id);
    if (error) throw error;
    return;
  }
  // upsert
  const { error } = await supabase
    .from(row.table as never)
    .upsert(row.payload as never, { onConflict: "id" });
  if (error) throw error;
}

async function pushOnce(): Promise<{ drained: number; remaining: number }> {
  const db = getDB();
  const now = Date.now();
  const batch = await db.outbox
    .where("status").equals("pending")
    .and((r) => r.next_attempt_at <= now)
    .limit(PUSH_BATCH)
    .toArray();

  let drained = 0;
  for (const row of batch) {
    try {
      await db.outbox.update(row.id, { status: "in-flight" });
      await applyOutboxRow(row);
      await db.outbox.delete(row.id);
      drained++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const wait = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      await db.outbox.update(row.id, {
        status: attempts >= BACKOFF_MS.length + 3 ? "failed" : "pending",
        attempts,
        next_attempt_at: Date.now() + wait,
        last_error: (e as Error)?.message ?? String(e),
      });
      logDiag("warn", `sync push failed for ${row.table}/${row.row_id}`, (e as Error)?.message);
    }
  }

  const remaining = await db.outbox.where("status").anyOf("pending", "in-flight").count();
  return { drained, remaining };
}

// ----------------- Orchestrator -----------------

let runInFlight: Promise<void> | null = null;
let pendingRerun = false;

export async function runSync(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit({ status: "offline" });
    return;
  }
  if (runInFlight) {
    pendingRerun = true;
    return runInFlight;
  }
  runInFlight = (async () => {
    emit({ status: "syncing", lastError: null });
    try {
      // push first so subsequent pull reflects our writes
      const { remaining } = await pushOnce();
      await pullOnce();
      emit({
        status: "idle",
        pending: remaining,
        lastRunAt: Date.now(),
        lastError: null,
      });
      await metaSet(META_KEYS.lastSyncRunAt, Date.now());
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      emit({ status: "error", lastError: msg, lastRunAt: Date.now() });
      await metaSet(META_KEYS.lastSyncError, msg);
      logDiag("warn", "sync run failed", msg);
    } finally {
      runInFlight = null;
      if (pendingRerun) {
        pendingRerun = false;
        void runSync();
      }
    }
  })();
  return runInFlight;
}

export async function refreshPendingCount(): Promise<void> {
  try {
    const pending = await getDB().outbox.where("status").anyOf("pending", "in-flight").count();
    emit({ pending });
  } catch { /* ignore */ }
}
