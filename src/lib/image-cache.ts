// Persistent image blob cache backed by IndexedDB (Dexie).
//
// Fetches an image once, stores the Blob locally, and returns a stable
// object URL on subsequent loads — so pages never re-download.

import { getDB } from "@/offline/db";

// Object URLs are per-session; keep a runtime map so React re-renders
// reuse the same URL for a given key.
const runtimeUrls = new Map<string, string>();

function makeObjectUrl(key: string, blob: Blob): string {
  const existing = runtimeUrls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  runtimeUrls.set(key, url);
  return url;
}

export async function getCachedBlobUrl(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cached = runtimeUrls.get(key);
  if (cached) return cached;
  try {
    const row = await getDB().image_blobs.get(key);
    if (!row?.blob) return null;
    return makeObjectUrl(key, row.blob);
  } catch {
    return null;
  }
}

export async function cacheImageBlob(
  key: string,
  fetchUrl: string,
  source = "book-pages",
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(fetchUrl, { cache: "no-store", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    try {
      await getDB().image_blobs.put({
        key,
        blob,
        mime: blob.type || "image/jpeg",
        size: blob.size,
        cached_at: Date.now(),
        source,
      });
    } catch { /* quota */ }
    return makeObjectUrl(key, blob);
  } catch {
    return null;
  }
}

export async function ensureCachedBlobUrl(
  key: string,
  fetchUrl: string,
  source = "book-pages",
): Promise<string | null> {
  const cached = await getCachedBlobUrl(key);
  if (cached) return cached;
  return cacheImageBlob(key, fetchUrl, source);
}
