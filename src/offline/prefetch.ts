// Background image prefetcher.
//
// On app open, discovers image storage paths referenced by content (book
// pages, About/Timeline photos) and downloads them into a persistent Dexie
// blob cache (`image_blobs`) so future renders never re-hit the network
// even though Supabase signed URLs rotate every session. Silent, best-
// effort, non-blocking.

import { supabase } from "@/integrations/supabase/client";
import { getDB } from "./db";
import { ensureCachedImages, getImageBlobStats } from "./image-blobs";

let running = false;
let lastRunAt = 0;

async function collectBookPagePaths(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("book_pages" as never)
      .select("storage_path");
    if (error || !data) return [];
    return (data as Array<{ storage_path: string }>).map((r) => r.storage_path).filter(Boolean);
  } catch {
    return [];
  }
}

async function collectAboutMediaPaths(): Promise<string[]> {
  try {
    const [church, timeline] = await Promise.all([
      supabase.from("about_church_entries" as never).select("photo_urls,is_published"),
      supabase.from("church_timeline_articles" as never).select("photo_urls,is_published"),
    ]);
    const paths = new Set<string>();
    const push = (rows: any) => {
      for (const r of rows ?? []) {
        if (!r?.is_published) continue;
        for (const p of r.photo_urls ?? []) if (p) paths.add(p);
      }
    };
    push(church.data); push(timeline.data);
    return [...paths];
  } catch {
    return [];
  }
}

export async function prefetchAllImages(): Promise<void> {
  if (typeof window === "undefined") return;
  if (running) return;
  if (!navigator.onLine) return;
  if (Date.now() - lastRunAt < 60_000) return;
  running = true;
  try {
    const [bookPaths, aboutPaths] = await Promise.all([
      collectBookPagePaths(),
      collectAboutMediaPaths(),
    ]);
    // Chunk to keep memory bounded
    for (let i = 0; i < bookPaths.length; i += 40) {
      await ensureCachedImages("book-pages", bookPaths.slice(i, i + 40));
    }
    for (let i = 0; i < aboutPaths.length; i += 40) {
      await ensureCachedImages("about-media", aboutPaths.slice(i, i + 40));
    }
    lastRunAt = Date.now();
  } finally {
    running = false;
  }
}

export async function getCachedImageStats(): Promise<{ count: number; bytes: number }> {
  return getImageBlobStats();
}

export async function isColdCacheEmpty(): Promise<boolean> {
  try {
    const [imgs, books] = await Promise.all([
      getDB().image_blobs.count(),
      getDB().books.count(),
    ]);
    return imgs === 0 && books === 0;
  } catch {
    return true;
  }
}
