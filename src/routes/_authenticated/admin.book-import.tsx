// Image Import Engine — Lord's Supper, Ashaya Rabbani, Prata Kaal & Sayan Kalin.
// Accepts JPG/JPEG/PNG/WEBP/PDF. PDFs are rasterised page-by-page and appended in order.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import { BookOpen, FileUp, CheckCircle2, Trash2 } from "lucide-react";
import { useAdminGuard } from "../../lib/use-admin-guard";
import {
  IMAGE_BOOK_SLUGS,
  listBookPages,
  nextPageNumber,
  uploadPageImage,
  loadPdfJs,
  renderPdfPageToBlob,
  imageDimensions,
  deletePage,
  signPageUrls,
  type BookPage,
} from "@/lib/book-pages";
import type { Book } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/book-import")({
  component: BookImportPage,
});

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

function BookImportPage() {
  const { checked } = useAdminGuard();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>("");
  const [pages, setPages] = useState<BookPage[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [lastImport, setLastImport] = useState<{ bookName: string; count: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentBook = useMemo(() => books.find((b) => b.id === bookId) ?? null, [books, bookId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("books")
        .select("*")
        .in("slug", IMAGE_BOOK_SLUGS as unknown as string[])
        .order("sort_order");
      const list = (data ?? []) as Book[];
      setBooks(list);
      if (list[0] && !bookId) setBookId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshPages = async (bId: string) => {
    const list = await listBookPages(bId);
    setPages(list);
    try {
      const urls = await signPageUrls(list.map((p) => p.storage_path), 3600);
      setThumbUrls(urls);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (bookId) void refreshPages(bookId); }, [bookId]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !currentBook) return;
    const files = Array.from(fileList);
    const bad = files.find((f) => !ALLOWED_EXT.has(f.name.toLowerCase().split(".").pop() ?? ""));
    if (bad) { toast.error(`Unsupported file: ${bad.name}`); return; }

    setBusy(true); setProgress(0); setPhase("Preparing…"); setLastImport(null);
    let startNumber = await nextPageNumber(currentBook.id);
    let imported = 0;
    const total = await estimateTotalPages(files);
    let done = 0;

    try {
      for (const file of files) {
        const ext = file.name.toLowerCase().split(".").pop() ?? "";
        if (ext === "pdf") {
          setPhase(`Reading ${file.name}…`);
          const pdfjs = await loadPdfJs();
          const buf = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: buf }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            setPhase(`${file.name} — page ${i}/${pdf.numPages}`);
            const page = await pdf.getPage(i);
            const { blob, width, height } = await renderPdfPageToBlob(page, 1.75);
            await uploadPageImage(currentBook.slug, currentBook.id, startNumber, blob, "jpg", { width, height });
            startNumber++; imported++; done++;
            setProgress(Math.round((done / total) * 100));
            // let browser breathe
            await new Promise((r) => setTimeout(r, 0));
          }
        } else {
          setPhase(`Uploading ${file.name}…`);
          const dims = await imageDimensions(file).catch(() => undefined);
          await uploadPageImage(currentBook.slug, currentBook.id, startNumber, file, ext === "jpeg" ? "jpg" : ext, dims);
          startNumber++; imported++; done++;
          setProgress(Math.round((done / total) * 100));
        }
      }
      setLastImport({ bookName: currentBook.title_en, count: imported });
      toast.success(`Imported ${imported} page${imported === 1 ? "" : "s"} to ${currentBook.title_en}`);
      await refreshPages(currentBook.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setBusy(false); setPhase(""); setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (page: BookPage) => {
    if (!confirm(`Delete page ${page.page_number}? This cannot be undone.`)) return;
    try {
      await deletePage(page);
      toast.success(`Deleted page ${page.page_number}`);
      if (bookId) await refreshPages(bookId);
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  if (!checked) return null;

  return (
    <AppShell
      title="Book image import"
      left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>}
      hideNav
    >
      <div className="pt-3 pb-10 space-y-4 font-display">
        <div className="text-center space-y-0.5">
          <h2 className="text-xl font-semibold tracking-tight">Import images or PDF pages</h2>
          <p className="text-xs text-muted-foreground">Lord's Supper · Ashaya Rabbani · Prata Kaal &amp; Sayan Kalin</p>
        </div>

        {/* Book selector */}
        <Card className="p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">Target book</p>
          <div className="grid grid-cols-1 gap-2">
            {books.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBookId(b.id)}
                disabled={busy}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${bookId === b.id ? "ring-2 ring-foreground/40 bg-card" : "bg-secondary/40 hover:bg-secondary"}`}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-white"
                  style={{ background: `linear-gradient(140deg, ${b.accent_color}, ${b.accent_color}cc)` }}
                >
                  <BookOpen className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.title_en}</p>
                  <p className="text-xs text-muted-foreground truncate font-hi">{b.title_hi}</p>
                </div>
                {bookId === b.id && <CheckCircle2 className="h-5 w-5 text-foreground/70" />}
              </button>
            ))}
          </div>
        </Card>

        {/* Uploader */}
        <Card className="p-5 space-y-3">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add pages · JPG · PNG · WEBP · PDF
            </span>
          </div>
          <label className="block">
            <div className="rounded-2xl border-2 border-dashed border-border/70 p-6 text-center transition-colors hover:border-foreground/30">
              <FileUp className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                {busy ? phase : "Choose image(s) or a PDF"}
              </p>
              <p className="text-xs text-muted-foreground">
                {busy
                  ? "Please keep this screen open until finished."
                  : "Each PDF page becomes one image; page order is preserved."}
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={busy || !currentBook}
                className="mt-3 mx-auto block text-xs file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent disabled:opacity-50"
              />
              {busy && (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-foreground/70 transition-[width] duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{progress}%</p>
                </div>
              )}
            </div>
          </label>

          {lastImport && !busy && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
              <p className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Import complete</p>
              <p className="mt-1 text-xs">
                Added <strong>{lastImport.count}</strong> page{lastImport.count === 1 ? "" : "s"} to <strong>{lastImport.bookName}</strong>.
              </p>
            </div>
          )}
        </Card>

        {/* Existing pages */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Pages in {currentBook?.title_en ?? "book"}</p>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium">{pages.length}</span>
          </div>
          {pages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No pages yet — upload above to get started.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pages.map((p) => (
                <div key={p.id} className="group relative overflow-hidden rounded-xl border bg-card">
                  {thumbUrls[p.storage_path] ? (
                    <img src={thumbUrls[p.storage_path]} alt={`Page ${p.page_number}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="aspect-[3/4] w-full grid place-items-center text-[11px] text-muted-foreground">…</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                    <span>#{p.page_number}</span>
                    <button
                      onClick={() => handleDelete(p)}
                      className="rounded p-0.5 hover:bg-white/20"
                      aria-label={`Delete page ${p.page_number}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

async function estimateTotalPages(files: File[]): Promise<number> {
  let total = 0;
  for (const f of files) {
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (ext === "pdf") {
      try {
        const pdfjs = await loadPdfJs();
        const buf = await f.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        total += pdf.numPages;
      } catch { total += 1; }
    } else {
      total += 1;
    }
  }
  return Math.max(1, total);
}
