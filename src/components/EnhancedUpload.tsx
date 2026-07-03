// Enhanced Upload — Target 2 of master spec.
// Two modes: A) Attach (view file: image/pdf), B) Scan (extract text via OCR / pdf text layer / txt).
// Plus a TXT song splitter for "Song #NN" headings.
import { useCallback, useMemo, useRef, useState } from "react";
import { FileUp, Image as ImageIcon, FileText, ScanLine, RefreshCw, ChevronLeft, ChevronRight, X } from "lucide-react";

export type UploadState =
  | "idle"
  | "mode-select"
  | "loading"
  | "attach-view"
  | "scan-processing"
  | "scan-result"
  | "song-split"
  | "error";

type Mode = "attach" | "scan";
type Kind = "image" | "pdf" | "txt";

interface Song { id: string; title: string; body: string }
interface ErrorInfo {
  kind: "size" | "ocr" | "type" | "pdf" | "network";
  message: string;
  sizeBytes?: number;
}

const MAX_BYTES = 10 * 1024 * 1024;

function detectKind(file: File): Kind | null {
  const ext = file.name.toLowerCase().split(".").pop();
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext ?? "")) return "image";
  if (file.type === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  return null;
}

function splitSongs(text: string): Song[] {
  const lines = text.split(/\r?\n/);
  const headingRe = /^\s*Song\s*#?\s*(\d+)\b\s*(.*)$/i;
  const songs: Song[] = [];
  let current: Song | null = null;
  for (const raw of lines) {
    const m = raw.match(headingRe);
    if (m) {
      if (current) songs.push(current);
      const num = m[1];
      const rest = (m[2] ?? "").trim();
      current = { id: num, title: rest || `Song #${num}`, body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + raw;
    }
  }
  if (current) songs.push(current);
  return songs.map((s) => ({ ...s, body: s.body.trim() }));
}

export function EnhancedUpload({ onExtracted }: { onExtracted?: (text: string) => void }) {
  const [state, setState] = useState<UploadState>("idle");
  const [mode, setMode] = useState<Mode>("attach");
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]); // data URLs for attach mode
  const [pageIdx, setPageIdx] = useState(0);
  const [extracted, setExtracted] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setState("idle"); setFile(null); setKind(null); setImgUrl(null); setPdfPages([]);
    setPageIdx(0); setExtracted(""); setProgress(0); setError(null); setSongs([]);
    if (inputRef.current) inputRef.current.value = "";
  }, [imgUrl]);

  const acceptAttr = "image/*,application/pdf";

  const handleFile = useCallback(async (f: File, currentMode: Mode) => {
    setError(null); setExtracted(""); setSongs([]); setPdfPages([]); setPageIdx(0);
    if (f.size > MAX_BYTES) {
      setFile(f); setError({ kind: "size", message: "File exceeds 10 MB.", sizeBytes: f.size }); setState("error"); return;
    }
    const k = detectKind(f);
    if (!k) { setFile(f); setError({ kind: "type", message: "Unsupported file. Allowed: images, PDF, TXT (scan mode only)." }); setState("error"); return; }
    if (currentMode === "attach" && k === "txt") {
      setFile(f); setError({ kind: "type", message: "Attach mode supports images and PDFs only." }); setState("error"); return;
    }
    setFile(f); setKind(k); setState("loading");
    try {
      if (currentMode === "attach") {
        if (k === "image") {
          const url = URL.createObjectURL(f);
          setImgUrl(url); setState("attach-view");
        } else if (k === "pdf") {
          const pages = await renderPdfPages(f);
          setPdfPages(pages); setState("attach-view");
        }
      } else {
        // scan mode
        if (k === "txt") {
          const text = await f.text();
          finishExtraction(text);
        } else if (k === "pdf") {
          const text = await extractPdfText(f);
          if (!text.trim()) {
            setError({ kind: "pdf", message: "PDF has no text layer. Use Attach mode or upload an image to OCR." });
            setState("error"); return;
          }
          finishExtraction(text);
        } else if (k === "image") {
          setState("scan-processing"); setProgress(0);
          const text = await ocrImage(f, (p) => setProgress(p));
          if (!text.trim()) { setError({ kind: "ocr", message: "Could not recognise any text in the image." }); setState("error"); return; }
          finishExtraction(text);
        }
      }
    } catch (e: any) {
      const msg = (e?.message ?? "").toString();
      if (/network|fetch|load/i.test(msg)) setError({ kind: "network", message: "Network error while processing the file." });
      else if (k === "pdf") setError({ kind: "pdf", message: msg || "Could not read this PDF." });
      else if (currentMode === "scan" && k === "image") setError({ kind: "ocr", message: msg || "OCR failed." });
      else setError({ kind: "type", message: msg || "Failed to read file." });
      setState("error");
    }
  }, []);

  function finishExtraction(text: string) {
    setExtracted(text); onExtracted?.(text);
    if (file?.name.toLowerCase().endsWith(".txt")) {
      const parsed = splitSongs(text);
      if (parsed.length > 0) { setSongs(parsed); setState("song-split"); return; }
    }
    setState("scan-result");
  }

  const summary = useMemo(() => {
    if (!file) return null;
    const kb = (file.size / 1024).toFixed(1);
    return `${file.name} · ${kb} KB`;
  }, [file]);

  return (
    <div className="space-y-4">
      {/* Mode picker */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/70 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => { setMode("attach"); if (state !== "idle") reset(); }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2 transition ${mode === "attach" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          <ImageIcon className="h-4 w-4" /> Attach (view)
        </button>
        <button
          type="button"
          onClick={() => { setMode("scan"); if (state !== "idle") reset(); }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2 transition ${mode === "scan" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          <ScanLine className="h-4 w-4" /> Scan (text)
        </button>
      </div>

      {/* Picker */}
      {(state === "idle" || state === "error") && (
        <label className="block">
          <div className="rounded-2xl border-2 border-dashed border-border/70 p-7 text-center transition-colors hover:border-foreground/30">
            <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              {mode === "attach" ? "Choose an image or PDF to view" : "Choose image (OCR), PDF or TXT"}
            </p>
            <p className="text-xs text-muted-foreground">Max 10 MB.</p>
            <input
              ref={inputRef}
              type="file"
              accept={acceptAttr}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, mode); }}
              className="mt-3 mx-auto block text-xs file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
            />
          </div>
        </label>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div className="rounded-2xl border border-border/60 p-6 text-center text-sm text-muted-foreground">
          Preparing {kind?.toUpperCase()}…
        </div>
      )}

      {/* Attach view */}
      {state === "attach-view" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{summary}</span>
            <button onClick={reset} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 hover:bg-accent">
              <X className="h-3 w-3" /> Close
            </button>
          </div>
          {kind === "image" && imgUrl && (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <img src={imgUrl} alt={file?.name ?? "attachment"} className="w-full h-auto select-none" style={{ touchAction: "pinch-zoom" }} />
              <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">Pinch to zoom</p>
            </div>
          )}
          {kind === "pdf" && pdfPages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <button
                  onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                  disabled={pageIdx === 0}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
                <span>Page {pageIdx + 1} of {pdfPages.length}</span>
                <button
                  onClick={() => setPageIdx((i) => Math.min(pdfPages.length - 1, i + 1))}
                  disabled={pageIdx === pdfPages.length - 1}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card transition-opacity duration-200" key={pageIdx}>
                <img src={pdfPages[pageIdx]} alt={`Page ${pageIdx + 1}`} className="w-full h-auto" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scan processing */}
      {state === "scan-processing" && (
        <div className="rounded-2xl border border-border/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><ScanLine className="h-4 w-4" /> Scanning image for text…</div>
          <progress value={progress} max={100} className="w-full h-2" />
          <p className="text-center text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      )}

      {/* Scan result */}
      {state === "scan-result" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {summary}</span>
            <button onClick={reset} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 hover:bg-accent">
              <X className="h-3 w-3" /> Close
            </button>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 max-h-80 overflow-auto">
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-display">{extracted}</pre>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Text inserted into the editor below — review and publish.</p>
        </div>
      )}

      {/* Song split */}
      {state === "song-split" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="rounded-full bg-secondary px-3 py-1 font-medium">{songs.length} songs detected in this file.</span>
            <button onClick={reset} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 hover:bg-accent">
              <X className="h-3 w-3" /> Close
            </button>
          </div>
          <div className="space-y-2">
            {songs.map((s) => (
              <details key={s.id} className="rounded-2xl border border-border/60 bg-card p-3">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">{s.id}</span>
                  <span className="flex-1 truncate text-sm font-medium">{s.title}</span>
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{s.body}</pre>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Errors — 5 variants */}
      {state === "error" && error && (
        <ErrorPanel error={error} onRetry={() => file && handleFile(file, mode)} onReset={reset} />
      )}
    </div>
  );
}

function ErrorPanel({ error, onRetry, onReset }: { error: ErrorInfo; onRetry: () => void; onReset: () => void }) {
  const palette = "rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900";
  if (error.kind === "size") {
    const mb = error.sizeBytes ? (error.sizeBytes / (1024 * 1024)).toFixed(2) : "?";
    return (
      <div className={palette}>
        <p className="font-semibold">File too large</p>
        <p className="mt-1">This file is {mb} MB. The maximum allowed size is 10 MB.</p>
        <div className="mt-3"><button onClick={onReset} className="rounded-full bg-red-900 px-3 py-1.5 text-xs font-semibold text-white">Choose another file</button></div>
      </div>
    );
  }
  if (error.kind === "ocr") {
    return (
      <div className={palette}>
        <p className="font-semibold">OCR failed</p>
        <p className="mt-1">{error.message}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={onRetry} className="inline-flex items-center gap-1 rounded-full bg-red-900 px-3 py-1.5 text-xs font-semibold text-white"><RefreshCw className="h-3 w-3" /> Retry</button>
          <button onClick={onReset} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-red-900 border border-red-200">Cancel</button>
        </div>
      </div>
    );
  }
  if (error.kind === "type") {
    return (
      <div className={palette}>
        <p className="font-semibold">Unsupported file type</p>
        <p className="mt-1">{error.message}</p>
        <p className="mt-2 text-xs">Allowed: PNG, JPG, WEBP, PDF, and TXT (scan mode only).</p>
        <div className="mt-3"><button onClick={onReset} className="rounded-full bg-red-900 px-3 py-1.5 text-xs font-semibold text-white">Choose another file</button></div>
      </div>
    );
  }
  if (error.kind === "pdf") {
    return (
      <div className={palette}>
        <p className="font-semibold">Could not read PDF</p>
        <p className="mt-1">{error.message}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={onRetry} className="inline-flex items-center gap-1 rounded-full bg-red-900 px-3 py-1.5 text-xs font-semibold text-white"><RefreshCw className="h-3 w-3" /> Retry</button>
          <button onClick={onReset} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-red-900 border border-red-200">Cancel</button>
        </div>
      </div>
    );
  }
  // network
  return (
    <div className={palette}>
      <p className="font-semibold">Network error</p>
      <p className="mt-1">{error.message} Check your connection and try again.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onRetry} className="inline-flex items-center gap-1 rounded-full bg-red-900 px-3 py-1.5 text-xs font-semibold text-white"><RefreshCw className="h-3 w-3" /> Retry</button>
        <button onClick={onReset} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-red-900 border border-red-200">Cancel</button>
      </div>
    </div>
  );
}

// ── pdfjs helpers ─────────────────────────────────────────────────────────────
async function loadPdfJs() {
  const pdfjs: any = await import("pdfjs-dist");
  const workerMod: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function renderPdfPages(file: File): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.85));
  }
  return out;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    parts.push(tc.items.map((it: any) => it.str).join(" "));
  }
  return parts.join("\n\n").trim();
}

async function ocrImage(file: File, onProgress: (p: number) => void): Promise<string> {
  const Tesseract: any = await import("tesseract.js");
  const url = URL.createObjectURL(file);
  try {
    const result = await Tesseract.recognize(url, "eng", {
      logger: (m: any) => { if (m.status === "recognizing text" && typeof m.progress === "number") onProgress(m.progress * 100); },
    });
    return (result?.data?.text ?? "").trim();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default EnhancedUpload;
