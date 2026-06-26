import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import type { Book } from "../../lib/types";
import { FileUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/upload")({
  component: UploadPage,
});

type Kind = "song" | "section";

function UploadPage() {
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
      <div className="pt-4 space-y-4">
        <Card className="p-5">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Choose PDF, DOCX or TXT</span>
            <div className="mt-2 rounded-2xl border-2 border-dashed p-6 text-center">
              <FileUp className="mx-auto h-7 w-7 text-muted-foreground" />
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                className="mt-3 mx-auto block text-xs"
              />
              {parsing && <p className="mt-2 text-xs text-muted-foreground">Parsing…</p>}
            </div>
          </label>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1 text-sm font-medium">
            <button onClick={() => setKind("song")} className={`rounded-lg py-2 ${kind === "song" ? "bg-card shadow" : ""}`}>As a song</button>
            <button onClick={() => setKind("section")} className={`rounded-lg py-2 ${kind === "section" ? "bg-card shadow" : ""}`}>As book section</button>
          </div>

          {kind === "section" && (
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Target book</span>
              <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm">
                {books.filter((b) => b.slug !== "song-book").map((b) => (
                  <option key={b.id} value={b.id}>{b.title_en}</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-3 gap-2">
            <label className="block col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Title (Hindi)</span>
              <input value={titleHi} onChange={(e) => setTitleHi(e.target.value)} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm font-hi" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Number</span>
              <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Title (English, optional)</span>
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Body</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm font-hi" />
          </label>

          <div className="flex gap-2">
            <button onClick={publish} disabled={saving} className="flex-1 rounded-xl brand-bg py-3 text-sm font-semibold disabled:opacity-50">
              {saving ? "Publishing…" : "Publish to library"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                if (!(titleHi || titleEn || number || body)) return;
                if (!confirm("Clear all fields and start over?")) return;
                setTitleHi(""); setTitleEn(""); setNumber(""); setBody("");
                toast.success("Cleared — write fresh");
              }}
              className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-accent"
            >
              Clear
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
