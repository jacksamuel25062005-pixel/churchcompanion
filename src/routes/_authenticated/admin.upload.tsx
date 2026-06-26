import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import type { Book } from "../../lib/types";
import { FileUp } from "lucide-react";
import { useAdminGuard } from "../../lib/use-admin-guard";

export const Route = createFileRoute("/_authenticated/admin/upload")({
  component: UploadPage,
});

type Kind = "song" | "section";

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("books").select("*").order("sort_order");
      setBooks((data ?? []) as Book[]);
      const songBook = (data ?? []).find((b: Book) => b.slug === "song-book");
      if (songBook) setBookId(songBook.id);
    })();
  }, []);

  const onFile = async (file: File) => {
    setParsing(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      const buf = await file.arrayBuffer();
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
        }
        text = parts.join("\n\n");
      } else {
        throw new Error("Unsupported file type. Use PDF, DOCX or TXT.");
      }
      setBody(text.trim());
      if (!titleHi) {
        const firstLine = text.trim().split("\n")[0] ?? "";
        setTitleHi(firstLine.slice(0, 120));
      }
      toast.success("Parsed — review and publish");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse");
    } finally {
      setParsing(false);
    }
  };

  const publish = async () => {
    if (!body.trim()) { toast.error("Body is empty"); return; }
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
      toast.success("Published");
      setTitleHi(""); setTitleEn(""); setBody(""); setNumber("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Upload content" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-6 pb-10 space-y-5 font-display">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Add to the library</h2>
          <p className="text-sm text-muted-foreground">Import a file or write directly — review, then publish.</p>
        </div>

        <Card className="p-6">
          <label className="block">
            <span className="block text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Import file</span>
            <div className="mt-3 rounded-2xl border-2 border-dashed border-border/70 p-7 text-center transition-colors hover:border-foreground/30">
              <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Choose PDF, DOCX or TXT</p>
              <p className="text-xs text-muted-foreground">We'll parse the text — you confirm before publishing.</p>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                className="mt-3 mx-auto block text-xs file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
              />
              {parsing && <p className="mt-2 text-xs text-muted-foreground">Parsing…</p>}
            </div>
          </label>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/70 p-1 text-sm font-medium">
            <button onClick={() => setKind("song")} className={`rounded-xl py-2 transition ${kind === "song" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>As a song</button>
            <button onClick={() => setKind("section")} className={`rounded-xl py-2 transition ${kind === "section" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>As book section</button>
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
              <Field label="Title (Hindi)">
                <input value={titleHi} onChange={(e) => setTitleHi(e.target.value)} className={`${inputCls} font-hi text-center`} placeholder="शीर्षक" />
              </Field>
            </div>
            <Field label="Number">
              <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" className={`${inputCls} text-center`} placeholder="#" />
            </Field>
          </div>

          <Field label="Title (English, optional)">
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={`${inputCls} text-center`} placeholder="Title" />
          </Field>

          <Field label="Body">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={11}
              className={`${inputCls} font-hi leading-relaxed text-left`}
              placeholder="Type or paste content here…"
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                if (!(titleHi || titleEn || number || body)) return;
                if (!confirm("Clear all fields and start over?")) return;
                setTitleHi(""); setTitleEn(""); setNumber(""); setBody("");
                toast.success("Cleared — write fresh");
              }}
              className="rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              Clear
            </button>
            <button onClick={publish} disabled={saving} className="flex-1 rounded-2xl brand-bg py-3 text-sm font-semibold tracking-wide disabled:opacity-50">
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
