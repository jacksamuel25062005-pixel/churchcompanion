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
export async function signAboutMedia(paths: string[], expiresIn = 60 * 60 * 24 * 7): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = Array.from(new Set(paths.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(chunk, expiresIn);
    if (error) throw error;
    (data ?? []).forEach((row) => { if (row.signedUrl && row.path) out[row.path] = row.signedUrl; });
  }
  return out;
}

export async function removeAboutMedia(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
