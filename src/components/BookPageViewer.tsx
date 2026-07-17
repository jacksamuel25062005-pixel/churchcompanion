// Digital book viewer — pages as images with pinch/zoom, fullscreen, keyboard nav.
import { useEffect, useMemo, useState } from "react";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { BookPage } from "@/lib/book-pages";
import { signPageUrls } from "@/lib/book-pages";
import PageNavDock from "@/components/common/PageNavDock";

interface Props {
  pages: BookPage[];
  accentColor?: string;
}

export function BookPageViewer({ pages, accentColor = "#6366f1" }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const total = pages.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paths = pages.map((p) => p.storage_path);
      if (paths.length === 0) return;
      try {
        const map = await signPageUrls(paths, 60 * 60);
        if (!cancelled) setUrls(map);
      } catch {
        /* signing failed silently — viewer will show error state */
      }
    })();
    return () => { cancelled = true; };
  }, [pages]);

  const current = pages[idx];
  const currentUrl = current ? urls[current.storage_path] : undefined;

  const preload = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= 2; d++) {
      if (pages[idx + d]) list.push(urls[pages[idx + d].storage_path] ?? "");
      if (pages[idx - d]) list.push(urls[pages[idx - d].storage_path] ?? "");
    }
    return list.filter(Boolean);
  }, [idx, pages, urls]);

  const go = (delta: number) => {
    setIdx((i) => Math.max(0, Math.min(total - 1, i + delta)));
    setZoom(1);
  };

  // Hide bottom app dock while fullscreen
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (fullscreen) document.body.classList.add("dock-hidden");
    else document.body.classList.remove("dock-hidden");
    return () => { document.body.classList.remove("dock-hidden"); };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") setFullscreen(false);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.25));
      else if (e.key === "-") setZoom((z) => Math.max(1, z - 0.25));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, total]);

  if (total === 0) return null;

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden mb-24">
        <div
          className="relative bg-black/5 overflow-auto"
          style={{ maxHeight: "70vh", touchAction: "pinch-zoom" }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={`Page ${current!.page_number}`}
              className="w-full h-auto select-none block"
              draggable={false}
            />
          ) : (
            <div className="grid place-items-center py-24 text-xs text-muted-foreground">Loading page…</div>
          )}
          <button
            onClick={() => setFullscreen(true)}
            aria-label="Fullscreen"
            className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        {/* Page jump slider */}
        <div className="p-3">
          <div className="mb-2 text-center text-xs font-medium tabular-nums" style={{ color: accentColor }}>
            Page {idx + 1} <span className="text-muted-foreground">/ {total}</span>
          </div>
          <input
            type="range"
            min={1}
            max={total}
            value={idx + 1}
            onChange={(e) => { setIdx(parseInt(e.target.value, 10) - 1); setZoom(1); }}
            className="w-full accent-current"
            style={{ color: accentColor }}
          />
        </div>
      </div>


      {/* Hidden preloaders */}
      <div className="hidden">
        {preload.map((u) => (
          <img key={u} src={u} alt="" />
        ))}
      </div>

      {/* Floating page navigation dock — sits above app bottom nav, docks to bottom in fullscreen */}
      <PageNavDock
        currentPage={idx + 1}
        totalPages={total}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        isFullscreen={fullscreen}
      />

      {fullscreen && currentUrl && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black">
          <div className="flex items-center justify-between p-3 text-white">
            <button onClick={() => setFullscreen(false)} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium tabular-nums">Page {idx + 1} / {total}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Zoom out">
                <ZoomOut className="h-5 w-5" />
              </button>
              <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Zoom in">
                <ZoomIn className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div
            className="flex-1 overflow-auto grid place-items-start justify-center pb-28"
            style={{ touchAction: "pinch-zoom" }}
          >
            <img
              src={currentUrl}
              alt={`Page ${current!.page_number}`}
              className="select-none block transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", width: "100%", maxWidth: "100vw" }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default BookPageViewer;
