// Remastered book viewer — thumbnails, bookmarks, resume, rotate, brightness,
// night/sepia, two-page spread, download/share, tap-to-hide chrome.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bookmark,
  BookmarkCheck,
  Download,
  Grid3x3,
  Maximize2,
  Moon,
  RotateCw,
  Share2,
  Sun,
  SunMedium,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { BookPage } from "@/lib/book-pages";
import { signPageUrls } from "@/lib/book-pages";
import PageNavDock from "@/components/common/PageNavDock";
import { cn } from "@/lib/utils";

interface Props {
  pages: BookPage[];
  accentColor?: string;
}

type Theme = "light" | "sepia" | "night";

const LS = {
  last: (b: string) => `bv:last:${b}`,
  bm: (b: string) => `bv:bm:${b}`,
  theme: "bv:theme",
  brightness: "bv:brightness",
  spread: "bv:spread",
};

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export function BookPageViewer({ pages, accentColor = "#6366f1" }: Props) {
  const total = pages.length;
  const bookId = pages[0]?.book_id ?? "";

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(() => {
    const saved = bookId ? readLS<number>(LS.last(bookId), 0) : 0;
    return Math.max(0, Math.min(total - 1, saved));
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => readLS<Theme>(LS.theme, "light"));
  const [brightness, setBrightness] = useState<number>(() => readLS<number>(LS.brightness, 100));
  const [spread, setSpread] = useState<boolean>(() => readLS<boolean>(LS.spread, false));
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [bookmarks, setBookmarks] = useState<number[]>(() =>
    bookId ? readLS<number[]>(LS.bm(bookId), []) : [],
  );
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 900px) and (orientation: landscape)");
    const on = () => setWide(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);

  const useSpread = spread && wide;

  // Sign URLs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paths = pages.map((p) => p.storage_path);
      if (paths.length === 0) return;
      try {
        const map = await signPageUrls(paths, 60 * 60);
        if (!cancelled) setUrls(map);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [pages]);

  // Persist state
  useEffect(() => { if (bookId) writeLS(LS.last(bookId), idx); }, [bookId, idx]);
  useEffect(() => { writeLS(LS.theme, theme); }, [theme]);
  useEffect(() => { writeLS(LS.brightness, brightness); }, [brightness]);
  useEffect(() => { writeLS(LS.spread, spread); }, [spread]);
  useEffect(() => { if (bookId) writeLS(LS.bm(bookId), bookmarks); }, [bookId, bookmarks]);

  const current = pages[idx];
  const currentUrl = current ? urls[current.storage_path] : undefined;
  const nextPage = useSpread ? pages[idx + 1] : undefined;
  const nextUrl = nextPage ? urls[nextPage.storage_path] : undefined;

  const preload = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= 3; d++) {
      if (pages[idx + d]) list.push(urls[pages[idx + d].storage_path] ?? "");
      if (pages[idx - d]) list.push(urls[pages[idx - d].storage_path] ?? "");
    }
    return list.filter(Boolean);
  }, [idx, pages, urls]);

  const step = useSpread ? 2 : 1;
  const go = useCallback((delta: number) => {
    setIdx((i) => Math.max(0, Math.min(total - 1, i + delta * step)));
    setZoom(1);
  }, [total, step]);

  const jumpTo = (n: number) => {
    setIdx(Math.max(0, Math.min(total - 1, n)));
    setZoom(1);
    setThumbsOpen(false);
  };

  const isBookmarked = bookmarks.includes(idx + 1);
  const toggleBookmark = () => {
    const pn = idx + 1;
    setBookmarks((b) => {
      const on = b.includes(pn);
      const next = on ? b.filter((x) => x !== pn) : [...b, pn].sort((a, b) => a - b);
      toast.success(on ? `Removed bookmark on page ${pn}` : `Bookmarked page ${pn}`);
      return next;
    });
  };

  // Swipe
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) { touchRef.current = null; return; }
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || zoom !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - start.t < 600) {
      if (dx < 0) go(1); else go(-1);
    }
  };

  // Hide dock in fullscreen
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (fullscreen) document.body.classList.add("dock-hidden");
    else document.body.classList.remove("dock-hidden");
    return () => { document.body.classList.remove("dock-hidden"); };
  }, [fullscreen]);

  // Keyboard
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") setFullscreen(false);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.25));
      else if (e.key === "-") setZoom((z) => Math.max(1, z - 0.25));
      else if (e.key.toLowerCase() === "b") toggleBookmark();
      else if (e.key.toLowerCase() === "r") setRotate((r) => (r + 90) % 360);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, go]);

  const downloadCurrent = async () => {
    if (!currentUrl || !current) return;
    try {
      const res = await fetch(currentUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `page-${String(current.page_number).padStart(4, "0")}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Page saved");
    } catch { toast.error("Download failed"); }
  };

  const sharePage = async () => {
    if (!currentUrl || !current) return;
    try {
      const res = await fetch(currentUrl);
      const blob = await res.blob();
      const file = new File([blob], `page-${current.page_number}.jpg`, { type: blob.type || "image/jpeg" });
      // @ts-ignore
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: `Page ${current.page_number}` });
      } else if (navigator.share) {
        await navigator.share({ title: `Page ${current.page_number}`, text: `Page ${current.page_number}` });
      } else {
        await downloadCurrent();
      }
    } catch { /* user dismissed */ }
  };

  if (total === 0) return null;

  const themeBg = theme === "night" ? "#0b0b0f" : theme === "sepia" ? "#f4ecd8" : "transparent";
  const imgFilter = `brightness(${brightness}%) ${theme === "sepia" ? "sepia(0.35)" : ""} ${theme === "night" ? "invert(0.92) hue-rotate(180deg)" : ""}`.trim();

  const renderImg = (url: string | undefined, pageNum: number | undefined, extraStyle: React.CSSProperties = {}) => (
    url ? (
      <img
        src={url}
        alt={pageNum ? `Page ${pageNum}` : ""}
        className="w-full h-auto select-none block"
        style={{ transform: `rotate(${rotate}deg) scale(${zoom})`, transformOrigin: "center center", filter: imgFilter, transition: "transform 150ms ease", ...extraStyle }}
        draggable={false}
      />
    ) : (
      <div className="grid place-items-center py-24 text-xs text-muted-foreground">Loading page…</div>
    )
  );

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border/50 bg-background/40 backdrop-blur">
          <ToolbarBtn label="Thumbnails" onClick={() => setThumbsOpen(true)}><Grid3x3 className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn label={isBookmarked ? "Remove bookmark" : "Bookmark"} onClick={toggleBookmark} active={isBookmarked} accent={accentColor}>
            {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </ToolbarBtn>
          <ToolbarBtn label="Rotate" onClick={() => setRotate((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></ToolbarBtn>
          <ThemeToggle theme={theme} setTheme={setTheme} />
          {wide && (
            <ToolbarBtn label="Two-page spread" onClick={() => setSpread((s) => !s)} active={spread} accent={accentColor}>
              <span className="text-[11px] font-semibold px-1">2p</span>
            </ToolbarBtn>
          )}
          <div className="flex-1" />
          <ToolbarBtn label="Download page" onClick={downloadCurrent}><Download className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn label="Share" onClick={sharePage}><Share2 className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn label="Fullscreen" onClick={() => setFullscreen(true)}><Maximize2 className="h-4 w-4" /></ToolbarBtn>
        </div>

        {/* Brightness */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
          <SunMedium className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="range" min={40} max={130} value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
            className="flex-1 accent-current" style={{ color: accentColor }}
            aria-label="Brightness"
          />
          <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{brightness}%</span>
        </div>

        <div
          className="relative overflow-auto"
          style={{ maxHeight: "calc(100vh - 340px)", touchAction: "pinch-zoom", background: themeBg }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {useSpread ? (
            <div className="grid grid-cols-2 gap-1">
              <div className="min-w-0">{renderImg(currentUrl, current?.page_number)}</div>
              <div className="min-w-0">{renderImg(nextUrl, nextPage?.page_number)}</div>
            </div>
          ) : (
            renderImg(currentUrl, current?.page_number)
          )}
        </div>

        <div className="p-3">
          <div className="mb-2 text-center text-xs font-medium tabular-nums" style={{ color: accentColor }}>
            Page {idx + 1}{useSpread && nextPage ? `–${idx + 2}` : ""}{" "}
            <span className="text-muted-foreground">/ {total}</span>
            {bookmarks.length > 0 && (
              <span className="ml-2 text-muted-foreground">· {bookmarks.length} bookmark{bookmarks.length === 1 ? "" : "s"}</span>
            )}
          </div>
          <input
            type="range" min={1} max={total} value={idx + 1}
            onChange={(e) => { setIdx(parseInt(e.target.value, 10) - 1); setZoom(1); }}
            className="w-full accent-current" style={{ color: accentColor }}
          />
          {bookmarks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bookmarks.map((pn) => (
                <button
                  key={pn}
                  onClick={() => jumpTo(pn - 1)}
                  className="text-[11px] rounded-full px-2 py-0.5 border border-border/60 bg-background/60 hover:bg-accent tabular-nums"
                  style={{ color: accentColor }}
                >
                  <Bookmark className="inline h-3 w-3 mr-0.5" />
                  {pn}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preloaders */}
      <div className="hidden">{preload.map((u) => (<img key={u} src={u} alt="" />))}</div>

      <PageNavDock
        currentPage={idx + 1}
        totalPages={total}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        isFullscreen={fullscreen}
      />

      {/* Thumbnails sheet */}
      {thumbsOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setThumbsOpen(false)}>
          <div className="glass rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <span className="text-sm font-semibold">All pages · {total}</span>
              <button onClick={() => setThumbsOpen(false)} className="rounded-full p-2 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-auto p-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
              {pages.map((p, i) => {
                const u = urls[p.storage_path];
                const active = i === idx;
                const bm = bookmarks.includes(p.page_number);
                return (
                  <button
                    key={p.id}
                    onClick={() => jumpTo(i)}
                    className={cn(
                      "relative rounded-lg overflow-hidden border-2 bg-muted aspect-[3/4] group",
                      active ? "ring-2" : "border-transparent hover:border-border",
                    )}
                    style={active ? { borderColor: accentColor, boxShadow: `0 0 0 2px ${accentColor}` } : undefined}
                  >
                    {u ? (
                      <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">…</div>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] tabular-nums text-center py-0.5">
                      {p.page_number}
                    </span>
                    {bm && (
                      <span className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5" style={{ color: accentColor }}>
                        <BookmarkCheck className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen */}
      {fullscreen && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: theme === "sepia" ? "#1a1611" : "#000" }}>
          {!chromeHidden && (
            <div className="flex items-center justify-between p-3 text-white bg-black/40 backdrop-blur">
              <button onClick={() => setFullscreen(false)} className="rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
              <span className="text-sm font-medium tabular-nums">Page {idx + 1} / {total}</span>
              <div className="flex items-center gap-1">
                <IconBtn onClick={toggleBookmark} label="Bookmark">
                  {isBookmarked ? <BookmarkCheck className="h-5 w-5" style={{ color: accentColor }} /> : <Bookmark className="h-5 w-5" />}
                </IconBtn>
                <IconBtn onClick={() => setRotate((r) => (r + 90) % 360)} label="Rotate"><RotateCw className="h-5 w-5" /></IconBtn>
                <IconBtn onClick={() => setThumbsOpen(true)} label="Thumbnails"><Grid3x3 className="h-5 w-5" /></IconBtn>
                <IconBtn onClick={() => setZoom((z) => Math.max(1, z - 0.25))} label="Zoom out"><ZoomOut className="h-5 w-5" /></IconBtn>
                <IconBtn onClick={() => setZoom((z) => Math.min(4, z + 0.25))} label="Zoom in"><ZoomIn className="h-5 w-5" /></IconBtn>
              </div>
            </div>
          )}
          <div
            className="flex-1 overflow-auto grid place-items-start justify-center pb-28 cursor-pointer"
            style={{ touchAction: "pinch-zoom" }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={(e) => { if (e.detail === 1) setChromeHidden((h) => !h); }}
          >
            {currentUrl && (
              <img
                src={currentUrl}
                alt={`Page ${current!.page_number}`}
                className="select-none block"
                style={{
                  transform: `rotate(${rotate}deg) scale(${zoom})`,
                  transformOrigin: "top center",
                  width: "100%", maxWidth: "100vw",
                  filter: imgFilter,
                  transition: "transform 150ms ease",
                }}
                draggable={false}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ToolbarBtn({ children, onClick, label, active, accent }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean; accent?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-9 min-w-9 px-2 rounded-lg inline-flex items-center justify-center transition",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        active && "bg-accent",
      )}
      style={active && accent ? { color: accent } : undefined}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="rounded-full bg-white/10 p-2 hover:bg-white/20 text-white">
      {children}
    </button>
  );
}

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const next: Theme = theme === "light" ? "sepia" : theme === "sepia" ? "night" : "light";
  const Icon = theme === "night" ? Moon : theme === "sepia" ? Sun : SunMedium;
  const label = theme === "light" ? "Sepia" : theme === "sepia" ? "Night" : "Light";
  return (
    <ToolbarBtn label={`Theme: ${theme} → ${label}`} onClick={() => setTheme(next)}>
      <Icon className="h-4 w-4" />
    </ToolbarBtn>
  );
}

export default BookPageViewer;
