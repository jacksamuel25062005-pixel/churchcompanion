// Background image prefetcher.
//
// On app open, discovers all image URLs referenced by content (book pages
// signed URLs, book covers, storage assets) and fetches them in parallel
// batches so the runtime CacheFirst handler stores them in "cc-images-v1".
// Progress is tracked in Dexie (`cached_images`) so subsequent runs skip
// already-cached URLs. Silent, best-effort, non-blocking.

import { supabase } from "@/integrations/supabase/client";
import { getDB } from "./db";

const CONCURRENCY = 6;
const BATCH_DELAY_MS = 50;         // tiny idle between batches
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 7;

let running = false;
let lastRunAt = 0;

// Strip query so signed URLs (which change) hash to a stable key.
function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.origin}${url.pathname}`;
  } catch {
    return u;
  }
}

async function alreadyCached(url: string): Promise<boolean> {
  try {
    const row = await getDB().cached_images.get(normalizeUrl(url));
    return !!row;
  } catch {
    return false;
  }
}

async function markCached(url: string, size: number, source: string) {
  try {
    await getDB().cached_images.put({
      url: normalizeUrl(url),
      cached_at: Date.now(),
      size,
      source,
    });
  } catch { /* ignore */ }
}

async function fetchOne(url: string, source: string): Promise<void> {
  try {
    const res = await fetch(url, { cache: "no-store", credentials: "omit", mode: "cors" });
    if (!res.ok && res.type !== "opaque") return;
    const buf = await res.clone().arrayBuffer().catch(() => null);
    await markCached(url, buf?.byteLength ?? 0, source);
  } catch {
    /* offline or CORS — skip */
  }
}

async function runBatches(jobs: Array<{ url: string; source: string }>) {
  let i = 0;
  const workers: Promise<void>[] = [];
  const next = async () => {
    while (i < jobs.length) {
      const idx = i++;
      const j = jobs[idx];
      await fetchOne(j.url, j.source);
    }
  };
  for (let w = 0; w < CONCURRENCY; w++) workers.push(next());
  await Promise.all(workers);
  // yield
  await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
}

async function collectBookPageUrls(): Promise<Array<{ url: string; source: string }>> {
  try {
    const { data, error } = await supabase
      .from("book_pages" as never)
      .select("storage_path");
    if (error || !data) return [];
    const paths = (data as Array<{ storage_path: string }>).map((r) => r.storage_path);
    if (!paths.length) return [];

    // Filter out paths we've already cached (single scan → Set)
    const db = getDB();
    const cachedRows = await db.cached_images.toArray();
    const cachedSet = new Set(cachedRows.map((r) => r.url));
    const uncached = paths.filter((p) => {
      // We can't know the signed URL prefix without signing; skip only if
      // an existing cache entry ends with this path.
      for (const u of cachedSet) if (u.endsWith(p)) return false;
      return true;
    });
    if (!uncached.length) return [];

    // Sign in chunks of 100
    const jobs: Array<{ url: string; source: string }> = [];
    for (let i = 0; i < uncached.length; i += 100) {
      const chunk = uncached.slice(i, i + 100);
      const { data: signed } = await supabase.storage
        .from("book-pages")
        .createSignedUrls(chunk, SIGN_TTL_SECONDS);
      for (const item of signed ?? []) {
        if (item?.signedUrl) jobs.push({ url: item.signedUrl, source: "book-pages" });
      }
    }
    return jobs;
  } catch {
    return [];
  }
}

export async function prefetchAllImages(): Promise<void> {
  if (typeof window === "undefined") return;
  if (running) return;
  if (!navigator.onLine) return;
  // Don't hammer if we ran in the last 60s
  if (Date.now() - lastRunAt < 60_000) return;
  running = true;
  try {
    const jobs = await collectBookPageUrls();
    // Chunk work into rolling batches
    while (jobs.length) {
      const slice = jobs.splice(0, CONCURRENCY * 4);
      await runBatches(slice);
    }
    lastRunAt = Date.now();
  } finally {
    running = false;
  }
}

export async function getCachedImageStats(): Promise<{ count: number; bytes: number }> {
  try {
    const rows = await getDB().cached_images.toArray();
    return {
      count: rows.length,
      bytes: rows.reduce((s, r) => s + (r.size || 0), 0),
    };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

export async function isColdCacheEmpty(): Promise<boolean> {
  try {
    const [imgs, books] = await Promise.all([
      getDB().cached_images.count(),
      getDB().books.count(),
    ]);
    return imgs === 0 && books === 0;
  } catch {
    return true;
  }
}
