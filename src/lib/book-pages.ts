// Book pages helpers — image library per book (Lord's Supper, Ashaya Rabbani, Prata Sayan).
import { supabase } from "@/integrations/supabase/client";

export interface BookPage {
  id: string;
  book_id: string;
  page_number: number;
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const IMAGE_BOOK_SLUGS = ["lords-supper", "ashaya-rabbani", "prata-sayan"] as const;
export type ImageBookSlug = (typeof IMAGE_BOOK_SLUGS)[number];

export function isImageBook(slug?: string | null): slug is ImageBookSlug {
  return !!slug && (IMAGE_BOOK_SLUGS as readonly string[]).includes(slug);
}

export async function listBookPages(bookId: string): Promise<BookPage[]> {
  const { data, error } = await supabase
    .from("book_pages" as any)
    .select("*")
    .eq("book_id", bookId)
    .order("page_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as BookPage[];
}

export async function nextPageNumber(bookId: string): Promise<number> {
  const { data, error } = await supabase
    .from("book_pages" as any)
    .select("page_number")
    .eq("book_id", bookId)
    .order("page_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { page_number: number }[];
  return (rows[0]?.page_number ?? 0) + 1;
}

export async function signPageUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const map: Record<string, string> = {};
  // batch in chunks of 100
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from("book-pages").createSignedUrls(chunk, expiresIn);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    }
  }
  return map;
}

export async function uploadPageImage(
  bookSlug: string,
  bookId: string,
  pageNumber: number,
  blob: Blob,
  ext: string,
  dims?: { width: number; height: number },
) {
  const path = `${bookSlug}/${Date.now()}_${String(pageNumber).padStart(5, "0")}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("book-pages")
    .upload(path, blob, { contentType: blob.type || `image/${ext}`, upsert: false });
  if (upErr) throw upErr;
  const { error: insErr } = await supabase.from("book_pages" as any).insert({
    book_id: bookId,
    page_number: pageNumber,
    storage_path: path,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  } as any);
  if (insErr) throw insErr;
  return path;
}

export async function deletePage(page: BookPage) {
  await supabase.storage.from("book-pages").remove([page.storage_path]);
  await supabase.from("book_pages" as any).delete().eq("id", page.id);
}

// Load pdfjs lazily and share the config
export async function loadPdfJs() {
  const pdfjs: any = await import("pdfjs-dist");
  const workerMod: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

export async function renderPdfPageToBlob(page: any, scale = 1.75): Promise<{ blob: Blob; width: number; height: number }> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.82),
  );
  // free
  canvas.width = 0; canvas.height = 0;
  return { blob, width: viewport.width, height: viewport.height };
}

export async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
