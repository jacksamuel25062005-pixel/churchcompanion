import { supabase } from "@/integrations/supabase/client";

const BUCKET = "about-media";

/** Upload a File to about-media under `folder/`. Returns storage path. */
export async function uploadAboutMedia(folder: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

/** Batch-sign storage paths and return a { path: signedUrl } map. */
/** Batch-sign storage paths and return a { path: url } map, backed by a persistent blob cache. */
export async function signAboutMedia(paths: string[], _expiresIn = 60 * 60 * 24 * 7): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { resolveCachedImageUrls } = await import("@/offline/image-blobs");
  return resolveCachedImageUrls(BUCKET, paths);
}

export async function removeAboutMedia(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
