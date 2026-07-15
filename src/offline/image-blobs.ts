// Persistent per-path image blob cache.
//
// Stores decoded image bytes in Dexie keyed by `${bucket}/${path}` so we
// never re-download an image once we've fetched it, even though Supabase
// signed URLs change on every session. Returns blob: URLs that can be
// dropped straight into <img src>. Blob URLs live until the tab reloads.

import { supabase } from "@/integrations/supabase/client";
import { getDB } from "./db";

const SIGN_TTL_SECONDS = 60 * 60; // just needs to survive the fetch
const objectUrlCache = new Map<string, string>(); // key -> blob URL

function keyFor(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

function toUrl(key: string, blob: Blob): string {
  const existing = objectUrlCache.get(key);
  if (existing) return existing;
  const u = URL.createObjectURL(blob);
  objectUrlCache.set(key, u);
  return u;
}

async function readCached(bucket: string, paths: string[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  if (!paths.length) return out;
  try {
    const rows = await getDB().image_blobs.bulkGet(paths.map((p) => keyFor(bucket, p)));
    rows.forEach((r) => { if (r?.blob) out.set(r.path, r.blob); });
  } catch { /* ignore */ }
  return out;
}

async function storeBlob(bucket: string, path: string, blob: Blob) {
  try {
    await getDB().image_blobs.put({
      key: keyFor(bucket, path),
      bucket,
      path,
      blob,
      size: blob.size,
      mime: blob.type || "image/*",
      cached_at: Date.now(),
    });
  } catch { /* quota — best effort */ }
}

async function signAndFetch(bucket: string, paths: string[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  if (!paths.length) return out;
  const signed: Array<{ path: string; signedUrl: string }> = [];
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(chunk, SIGN_TTL_SECONDS);
    if (error) continue;
    for (const r of data ?? []) {
      if (r?.path && r?.signedUrl) signed.push({ path: r.path, signedUrl: r.signedUrl });
    }
  }
  // Parallel fetch, cap concurrency
  const CONCURRENCY = 6;
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < signed.length) {
      const idx = i++;
      const item = signed[idx];
      try {
        const res = await fetch(item.signedUrl, { credentials: "omit", mode: "cors" });
        if (!res.ok) continue;
        const blob = await res.blob();
        out.set(item.path, blob);
        await storeBlob(bucket, item.path, blob);
      } catch { /* ignore individual failures */ }
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Resolve `paths` in `bucket` to a { path: url } map.
 * Uses cached blobs when available; otherwise signs+fetches and caches.
 * Missing paths (network offline + not cached) are omitted from the map.
 */
export async function resolveCachedImageUrls(
  bucket: string,
  paths: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const out: Record<string, string> = {};
  const cached = await readCached(bucket, unique);
  const missing: string[] = [];
  for (const p of unique) {
    const blob = cached.get(p);
    if (blob) out[p] = toUrl(keyFor(bucket, p), blob);
    else missing.push(p);
  }
  if (missing.length && typeof navigator !== "undefined" && navigator.onLine !== false) {
    const fetched = await signAndFetch(bucket, missing);
    fetched.forEach((blob, p) => { out[p] = toUrl(keyFor(bucket, p), blob); });
  }
  return out;
}

/** Prefetch and store blobs for a set of paths; skip already-cached. */
export async function ensureCachedImages(bucket: string, paths: string[]): Promise<void> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return;
  const cached = await readCached(bucket, unique);
  const missing = unique.filter((p) => !cached.has(p));
  if (!missing.length) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  await signAndFetch(bucket, missing);
}

export async function getImageBlobStats(): Promise<{ count: number; bytes: number }> {
  try {
    const rows = await getDB().image_blobs.toArray();
    return { count: rows.length, bytes: rows.reduce((s, r) => s + (r.size || 0), 0) };
  } catch {
    return { count: 0, bytes: 0 };
  }
}
