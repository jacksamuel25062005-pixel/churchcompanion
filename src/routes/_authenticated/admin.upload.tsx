import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import type { Book } from "../../lib/types";
import { FileUp, CheckCircle2 } from "lucide-react";
import { useAdminGuard } from "../../lib/use-admin-guard";
import { EnhancedUpload } from "../../components/EnhancedUpload";

export const Route = createFileRoute("/_authenticated/admin/upload")({
  component: UploadPage,
});

type Kind = "song" | "section";

const DRAFT_KEY = "cc.upload.draft.v1";

interface Draft {
  kind: Kind;
  bookId: string;
  titleHi: string;
  titleEn: string;
  number: string;
  body: string;
}

function UploadPage() {
  const { checked } = useAdminGuard();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>("");
  const [kind, setKind] = useState<Kind>("song");
  const [titleHi, setTitleHi] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [number, setNumber] = useState<string>("");
  const [body, setBody] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState<number | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("books").select("*").order("sort_order");
      setBooks((data ?? []) as Book[]);
      const songBook = (data ?? []).find((b: Book) => b.slug === "song-book");
      if (songBook && !bookId) setBookId((prev) => prev || songBook.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore draft once
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (d.kind) setKind(d.kind);
      if (d.bookId) setBookId(d.bookId);
      if (d.titleHi) setTitleHi(d.titleHi);
      if (d.titleEn) setTitleEn(d.titleEn);
      if (d.number) setNumber(d.number);
      if (d.body) setBody(d.body);
      if (d.body || d.titleHi) toast("Draft restored", { description: "Your last unsaved work is here." });
    } catch { /* ignore */ }
  }, []);

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!restoredRef.current) return;
    const t = setTimeout(() => {
      const hasContent = titleHi || titleEn || number || body;
      if (!hasContent) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ kind, bookId, titleHi, titleEn, number, body }));
        setDraftSaved(Date.now());
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [kind, bookId, titleHi, titleEn, number, body]);

  const onFile = async (file: File) => {
    setParsing(true);
    setParseProgress(5);
    const tid = toast.loading(`Parsing ${file.name}…`);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      const buf = await file.arrayBuffer();
      setParseProgress(30);
      let text = "";
      if (ext === "txt") {
        text = new TextDecoder("utf-8").decode(buf);
      } else if (ext === "docx") {
        // @ts-expect-error - browser build has no types
        const mammoth: any = await import("mammoth/mammoth.browser");
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        text = result.value;
      } else if (ext === "pdf") {
        const pdfjs: any = await import("pdfjs-dist");
        const workerMod: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          parts.push(tc.items.map((it: any) => it.str).join(" "));
          setParseProgress(30 + Math.round((i / pdf.numPages) * 65));
        }
        text = parts.join("\n\n");
      } else {
        throw new Error("Unsupported file. Quick Import allows PDF, DOCX or TXT.");
      }
      setParseProgress(100);
      setBody(text.trim());
      if (!titleHi) {
        const firstLine = text.trim().split("\n")[0] ?? "";
        setTitleHi(firstLine.slice(0, 120));
      }
      toast.success("Parsed — review and publish", { id: tid });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse", { id: tid });
    } finally {
      setParsing(false);
      setTimeout(() => setParseProgress(0), 800);
    }
  };

  const bodyTrim = body.trim();
  const wordCount = bodyTrim ? bodyTrim.split(/\s+/).length : 0;
  const charCount = body.length;

  const canPublish =
    !saving &&
    bodyTrim.length > 0 &&
    (titleHi.trim().length > 0 || (kind === "section" && titleEn.trim().length > 0)) &&
    (kind === "song" || !!bookId);

  const publish = async () => {
    if (!canPublish) return;
    setSaving(true);
    try {
      if (kind === "song") {
        const num = number ? parseInt(number, 10) : null;
        const { error } = await supabase.from("songs").insert({
          number: Number.isFinite(num as number) ? num : null,
          title_hi: titleHi || "(untitled)",
          title_en: titleEn || null,
          lyrics_hi: body,
        });
        if (error) throw error;
      } else {
        if (!bookId) throw new Error("Pick a target book");
        const num = number ? parseInt(number, 10) : null;
        const { error } = await supabase.from("book_sections").insert({
          book_id: bookId,
          number: Number.isFinite(num as number) ? num : null,
          title_hi: titleHi || null,
          title_en: titleEn || null,
          body_hi: body,
        });
        if (error) throw error;
      }
      toast.success("Published to library");
      setTitleHi(""); setTitleEn(""); setBody(""); setNumber("");
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setDraftSaved(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!checked) return null;
  return (
    <AppShell title="Upload content" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-3 pb-10 space-y-4 font-display">
        <div className="text-center space-y-0.5">
          <h2 className="text-xl font-semibold tracking-tight">Add to the library</h2>
          <p className="text-xs text-muted-foreground">Import a file or write directly — review, then publish.</p>
        </div>

        {/* Quick Import — PDF/DOCX/TXT */}
        <Card className="p-5">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Import · PDF · DOCX · TXT
            </span>
          </div>
          <label className="mt-3 block">
            <div className="rounded-2xl border-2 border-dashed border-border/70 p-6 text-center transition-colors hover:border-foreground/30">
              <FileUp className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Choose PDF, DOCX or TXT</p>
              <p className="text-xs text-muted-foreground">Text-based documents — parsed straight into the editor.</p>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                disabled={parsing}
                className="mt-3 mx-auto block text-xs file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent disabled:opacity-50"
              />
              {parsing && (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-foreground/70 transition-[width] duration-300" style={{ width: `${parseProgress}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Parsing… {parseProgress}%</p>
                </div>
              )}
            </div>
          </label>
        </Card>

        {/* Enhanced Upload — Image + PDF OCR */}
        <Card className="p-5">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Enhanced Upload · Images & PDFs
            </span>
            <p className="mt-1.5 text-xs text-muted-foreground">View a document as-is, or OCR scanned images and PDFs into editable text.</p>
          </div>
          <div className="mt-3">
            <EnhancedUpload onExtracted={(t) => { setBody(t); if (!titleHi) setTitleHi(t.split("\n")[0]?.slice(0, 120) ?? ""); toast.success("Text extracted into editor"); }} />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          {/* Kind segmented control */}
          <div className="relative grid grid-cols-2 rounded-2xl bg-secondary/70 p-1 text-sm font-medium">
            <span
              aria-hidden
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-card shadow-sm ring-1 ring-border/60 transition-transform duration-300 ease-out"
              style={{ transform: kind === "song" ? "translateX(0%)" : "translateX(100%)" }}
            />
            <button
              type="button"
              onClick={() => setKind("song")}
              className={`relative z-10 rounded-xl py-2 transition-colors ${kind === "song" ? "text-foreground" : "text-muted-foreground"}`}
            >As a song</button>
            <button
              type="button"
              onClick={() => setKind("section")}
              className={`relative z-10 rounded-xl py-2 transition-colors ${kind === "section" ? "text-foreground" : "text-muted-foreground"}`}
            >As book section</button>
          </div>

          {kind === "section" && (
            <Field label="Target book">
              <select value={bookId} onChange={(e) => setBookId(e.target.value)} className={inputCls}>
                {books.filter((b) => b.slug !== "song-book").map((b) => (
                  <option key={b.id} value={b.id}>{b.title_en}</option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Title">
                <input value={titleHi} onChange={(e) => setTitleHi(e.target.value)} className={`${inputCls} font-hi text-center`} placeholder="शीर्षक" />
              </Field>
            </div>
            <Field label="Number">
              <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" className={`${inputCls} text-center`} placeholder="#" />
            </Field>
          </div>

          <Field label="Title (Hindi optional)">
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={`${inputCls} text-center font-hi`} placeholder="वैकल्पिक शीर्षक" />
          </Field>

          <div>
            <Field label="Body">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className={`${inputCls} font-hi leading-loose text-left`}
                placeholder="Type or paste content here…"
              />
            </Field>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span>{wordCount} words · {charCount} chars</span>
              <span className="inline-flex items-center gap-1">
                {draftSaved ? (<><CheckCircle2 className="h-3 w-3" /> Draft saved</>) : "Auto-save on"}
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                if (!(titleHi || titleEn || number || body)) return;
                if (!confirm("Clear all fields and delete draft?")) return;
                setTitleHi(""); setTitleEn(""); setNumber(""); setBody("");
                try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
                setDraftSaved(null);
                toast.success("Cleared — write fresh");
              }}
              className="rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              Clear
            </button>
            <button
              onClick={publish}
              disabled={!canPublish}
              title={!canPublish ? "Add a title and body first" : undefined}
              className="flex-1 rounded-2xl brand-bg py-3 text-sm font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Publishing…" : "Publish to library"}
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

const inputCls = "mt-1.5 w-full rounded-2xl border border-border/70 bg-secondary/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15 focus:bg-card transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
