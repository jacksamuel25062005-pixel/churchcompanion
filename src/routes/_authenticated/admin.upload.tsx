import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import type { Book } from "../../lib/types";
import { CheckCircle2, Layers, CalendarDays, Loader2 } from "lucide-react";
import { useAdminGuard } from "../../lib/use-admin-guard";
import { EnhancedUpload } from "../../components/EnhancedUpload";
import { parseSongs, type ConflictAction, type ImportSummary, type ParsedSong } from "../../lib/song-import";
import { extractAlmanacFromText, type AlmanacEntryDraft } from "../../lib/almanac-import.functions";

export const Route = createFileRoute("/_authenticated/admin/upload")({
  component: UploadPage,
});

type Destination = "song-book" | "lords-supper" | "ashaya-rabbani" | "prata-sayan" | "almanac";

const DESTINATIONS: { id: Destination; label: string }[] = [
  { id: "song-book", label: "Song Book" },
  { id: "lords-supper", label: "Lord's Supper" },
  { id: "ashaya-rabbani", label: "Ashaya Rabbani" },
  { id: "prata-sayan", label: "Prata Kaal & Sayan Kalin" },
  { id: "almanac", label: "Almanac" },
];

type AlmanacImportSummary = {
  year: number;
  month: number;
  month_name: string;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
};

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
  const [destination, setDestination] = useState<Destination>("song-book");
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>("");
  const [kind, setKind] = useState<Kind>("song");
  const [titleHi, setTitleHi] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [number, setNumber] = useState<string>("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState<number | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchSummary, setBatchSummary] = useState<ImportSummary | null>(null);
  const [conflictDefault, setConflictDefault] = useState<ConflictAction>("skip");
  const [perConflict, setPerConflict] = useState<Record<number, ConflictAction>>({});
  const [existingByNumber, setExistingByNumber] = useState<Record<number, string>>({});
  const restoredRef = useRef(false);

  // ── Almanac Import Engine state ───────────────────────────────────
  const [almanacText, setAlmanacText] = useState("");
  const [almanacBusy, setAlmanacBusy] = useState(false);
  const [almanacStage, setAlmanacStage] = useState<"idle" | "extracting" | "merging" | "done">("idle");
  const [almanacSummary, setAlmanacSummary] = useState<AlmanacImportSummary | null>(null);
  const extractAlmanac = useServerFn(extractAlmanacFromText);

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

  // ---- Song Import Engine (Song Book only) ----
  const parsedSongs: ParsedSong[] = kind === "song" ? parseSongs(body) : [];
  const canBatch = kind === "song" && parsedSongs.length >= 2;

  const openBatch = async () => {
    setBatchSummary(null);
    setPerConflict({});
    setBatchOpen(true);
    // Check which serial numbers already exist.
    const nums = Array.from(new Set(parsedSongs.map((s) => s.number)));
    if (nums.length === 0) return;
    const { data, error } = await supabase
      .from("songs")
      .select("id, number")
      .in("number", nums)
      .eq("is_deleted", false);
    if (error) {
      toast.error(`Could not check existing numbers: ${error.message}`);
      return;
    }
    const map: Record<number, string> = {};
    for (const r of (data ?? []) as { id: string; number: number | null }[]) {
      if (r.number != null) map[r.number] = r.id;
    }
    setExistingByNumber(map);
  };

  const runBatchImport = async () => {
    setBatchBusy(true);
    setBatchProgress({ done: 0, total: parsedSongs.length });
    const summary: ImportSummary = {
      detected: parsedSongs.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    for (let i = 0; i < parsedSongs.length; i++) {
      const s = parsedSongs[i];
      const existingId = existingByNumber[s.number];
      const action: ConflictAction = existingId
        ? (perConflict[s.number] ?? conflictDefault)
        : "duplicate"; // no conflict → just insert
      try {
        if (existingId && action === "skip") {
          summary.skipped++;
        } else if (existingId && action === "replace") {
          const { error } = await supabase
            .from("songs")
            .update({
              title_hi: s.title || "(untitled)",
              lyrics_hi: s.body,
            })
            .eq("id", existingId);
          if (error) throw error;
          summary.updated++;
        } else {
          // insert (duplicate or fresh)
          const { error } = await supabase.from("songs").insert({
            number: s.number,
            title_hi: s.title || "(untitled)",
            lyrics_hi: s.body,
          });
          if (error) throw error;
          summary.imported++;
        }
      } catch (e: any) {
        summary.failed++;
        summary.errors.push({ number: s.number, message: e?.message ?? "Unknown error" });
      }
      setBatchProgress({ done: i + 1, total: parsedSongs.length });
    }
    setBatchSummary(summary);
    setBatchBusy(false);
    toast.success(`Import complete — ${summary.imported} new, ${summary.updated} updated`);
  };

  const closeBatchAndReset = () => {
    setBatchOpen(false);
    if (batchSummary && (batchSummary.imported > 0 || batchSummary.updated > 0)) {
      setBody(""); setTitleHi(""); setTitleEn(""); setNumber("");
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setDraftSaved(null);
    }
    setBatchSummary(null);
    setBatchProgress(null);
  };

  // ── Almanac Import Engine ─────────────────────────────────────────
  const runAlmanacImport = async () => {
    const text = almanacText.trim();
    if (!text) { toast.error("Extract or paste text first"); return; }
    setAlmanacBusy(true);
    setAlmanacSummary(null);
    setAlmanacStage("extracting");
    try {
      const result = await extractAlmanac({ data: { text } });
      if (!result.entries.length) throw new Error("AI could not find any dated entries");
      setAlmanacStage("merging");

      // Which dates already exist?
      const dates = result.entries.map((e) => e.date);
      const { data: existing, error: exErr } = await supabase
        .from("almanac_entries")
        .select("date")
        .in("date", dates);
      if (exErr) throw exErr;
      const existingSet = new Set((existing ?? []).map((r: { date: string }) => r.date));

      let added = 0, updated = 0, failed = 0;
      const errors: string[] = [];
      for (const e of result.entries) {
        const row: AlmanacEntryDraft & { is_sunday: boolean } = {
          ...e,
          is_sunday: e.is_sunday ?? (e.day_name?.toLowerCase() === "sunday"),
        };
        const { error } = await supabase
          .from("almanac_entries")
          .upsert(row, { onConflict: "date" });
        if (error) { failed++; errors.push(`${e.date}: ${error.message}`); continue; }
        if (existingSet.has(e.date)) updated++; else added++;
      }

      setAlmanacSummary({
        year: result.year,
        month: result.month,
        month_name: result.month_name,
        added, updated, failed, errors,
      });
      setAlmanacStage("done");
      toast.success(`Almanac import complete — ${added} added, ${updated} updated`);
    } catch (e: any) {
      toast.error(e?.message ?? "Almanac import failed");
      setAlmanacStage("idle");
    } finally {
      setAlmanacBusy(false);
    }
  };

  const resetAlmanac = () => {
    setAlmanacText("");
    setAlmanacSummary(null);
    setAlmanacStage("idle");
  };





  if (!checked) return null;
  return (
    <AppShell title="Upload content" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-3 pb-10 space-y-4 font-display">
        <div className="text-center space-y-0.5">
          <h2 className="text-xl font-semibold tracking-tight">Add to the library</h2>
          <p className="text-xs text-muted-foreground">Import a file or write directly — review, then publish.</p>
        </div>


        {/* Destination selector */}
        <Card className="p-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Destination library
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DESTINATIONS.map((d) => {
              const active = destination === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDestination(d.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                      : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {d.id === "almanac" && <CalendarDays className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />}
                  {d.label}
                </button>
              );
            })}
          </div>
          {destination === "almanac" && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Almanac Import Engine will parse OCR/PDF text into structured calendar entries.
            </p>
          )}
        </Card>

        {destination === "almanac" ? (
          <AlmanacPanel
            almanacText={almanacText}
            setAlmanacText={setAlmanacText}
            busy={almanacBusy}
            stage={almanacStage}
            summary={almanacSummary}
            onRun={runAlmanacImport}
            onReset={resetAlmanac}
          />
        ) : (
          <>
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

          {canBatch && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
              <Layers className="mt-0.5 h-5 w-5 brand-text shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Multiple songs detected</p>
                <p className="text-xs text-muted-foreground">
                  Found <b>{parsedSongs.length}</b> songs in the body (Song #01, #02…). Import them all as separate Song Book entries.
                </p>
              </div>
              <button
                type="button"
                onClick={openBatch}
                className="rounded-xl brand-bg px-3 py-2 text-xs font-semibold"
              >
                Batch import
              </button>
            </div>
          )}



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
          </>
        )}
      </div>

      {batchOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => { if (!batchBusy) closeBatchAndReset(); }}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-card shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center gap-3">
              <Layers className="h-5 w-5 brand-text" />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">Batch import songs</h3>
                <p className="text-xs text-muted-foreground">{parsedSongs.length} songs detected in the document.</p>
              </div>
              <button
                onClick={() => { if (!batchBusy) closeBatchAndReset(); }}
                className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-accent"
                disabled={batchBusy}
              >Close</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {batchSummary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <SummaryStat label="Detected" value={batchSummary.detected} />
                    <SummaryStat label="Imported" value={batchSummary.imported} />
                    <SummaryStat label="Updated" value={batchSummary.updated} />
                    <SummaryStat label="Skipped" value={batchSummary.skipped} />
                    <SummaryStat label="Failed" value={batchSummary.failed} tone={batchSummary.failed ? "danger" : undefined} />
                  </div>
                  {batchSummary.errors.length > 0 && (
                    <div className="rounded-xl bg-destructive/10 p-3 text-xs">
                      <p className="font-semibold mb-1">Errors</p>
                      <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                        {batchSummary.errors.map((er, i) => (
                          <li key={i}>#{er.number}: {er.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Default for conflicts</p>
                    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/70 p-1 text-xs font-medium">
                      {(["skip", "replace", "duplicate"] as ConflictAction[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setConflictDefault(a)}
                          className={`rounded-xl py-2 capitalize transition ${conflictDefault === a ? "bg-card shadow-sm ring-1 ring-border/60 text-foreground" : "text-muted-foreground"}`}
                          disabled={batchBusy}
                        >{a}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-xl border">
                    {parsedSongs.map((s) => {
                      const conflict = !!existingByNumber[s.number];
                      const action = perConflict[s.number] ?? conflictDefault;
                      return (
                        <div key={`${s.number}-${s.title ?? ""}`} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 text-sm">
                          <span className="w-10 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">#{s.number}</span>
                          <span className="flex-1 min-w-0 truncate font-hi">{s.title ?? "(untitled)"}</span>
                          {conflict ? (
                            <select
                              value={action}
                              onChange={(e) => setPerConflict((p) => ({ ...p, [s.number]: e.target.value as ConflictAction }))}
                              disabled={batchBusy}
                              className="text-xs rounded-lg border bg-secondary/60 px-2 py-1"
                            >
                              <option value="skip">Skip</option>
                              <option value="replace">Replace</option>
                              <option value="duplicate">Duplicate</option>
                            </select>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">New</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {batchProgress && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full brand-bg transition-[width] duration-300" style={{ width: `${(batchProgress.done / Math.max(1, batchProgress.total)) * 100}%` }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Importing {batchProgress.done} / {batchProgress.total}…</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t flex gap-2">
              {batchSummary ? (
                <button onClick={closeBatchAndReset} className="flex-1 rounded-2xl brand-bg py-3 text-sm font-semibold">Done</button>
              ) : (
                <>
                  <button
                    onClick={() => { if (!batchBusy) closeBatchAndReset(); }}
                    disabled={batchBusy}
                    className="rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
                  >Cancel</button>
                  <button
                    onClick={runBatchImport}
                    disabled={batchBusy || parsedSongs.length === 0}
                    className="flex-1 rounded-2xl brand-bg py-3 text-sm font-semibold disabled:opacity-50"
                  >{batchBusy ? "Importing…" : `Import ${parsedSongs.length} songs`}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone === "danger" ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
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

function AlmanacPanel({
  almanacText, setAlmanacText, busy, stage, summary, onRun, onReset,
}: {
  almanacText: string;
  setAlmanacText: (v: string) => void;
  busy: boolean;
  stage: "idle" | "extracting" | "merging" | "done";
  summary: AlmanacImportSummary | null;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <Card className="p-5">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider brand-text">
            <CalendarDays className="h-3 w-3" /> Almanac Import · Extract Source
          </span>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Upload the monthly calendar PDF or image. OCR / PDF text is fed to the Almanac AI engine.
          </p>
        </div>
        <div className="mt-3">
          <EnhancedUpload onExtracted={(t) => { setAlmanacText(t); toast.success("Text captured for Almanac"); }} />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <Field label="Source text (editable)">
          <textarea
            value={almanacText}
            onChange={(e) => setAlmanacText(e.target.value)}
            rows={10}
            className={`${inputCls} leading-relaxed text-left`}
            placeholder="Extracted / pasted almanac source text will appear here…"
            disabled={busy}
          />
        </Field>

        {busy && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <Loader2 className="h-5 w-5 brand-text animate-spin shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold">Importing Almanac…</p>
              <p className="text-xs text-muted-foreground">
                {stage === "extracting" ? "Running AI extraction (Liturgical Calendar Master Prompt)…" : "Merging entries into the Almanac database…"}
              </p>
            </div>
          </div>
        )}

        {summary && stage === "done" && (
          <div className="rounded-2xl border border-emerald-300/50 bg-emerald-50/60 p-4 space-y-3">
            <p className="text-sm font-semibold text-emerald-900">
              Import complete — {summary.month_name} {summary.year}
            </p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <SummaryStat label="Days added" value={summary.added} />
              <SummaryStat label="Days updated" value={summary.updated} />
              <SummaryStat label="Failed" value={summary.failed} tone={summary.failed ? "danger" : undefined} />
            </div>
            {summary.errors.length > 0 && (
              <div className="rounded-xl bg-destructive/10 p-3 text-xs">
                <p className="font-semibold mb-1">Errors</p>
                <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                  {summary.errors.map((er, i) => <li key={i}>{er}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            {stage === "done" ? "Start over" : "Clear"}
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={busy || !almanacText.trim() || stage === "done"}
            className="flex-1 rounded-2xl brand-bg py-3 text-sm font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Importing Almanac…" : stage === "done" ? "Imported" : "Run Almanac Import"}
          </button>
        </div>
      </Card>
    </>
  );
}

