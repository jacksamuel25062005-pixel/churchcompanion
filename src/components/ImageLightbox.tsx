import { useEffect, useState, useCallback, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
};

export function ImageLightbox({ images, index, onClose, onIndexChange }: Props) {
  const [i, setI] = useState(index);

  useEffect(() => setI(index), [index]);

  const go = useCallback(
    (delta: number) => {
      setI((prev) => {
        const next = (prev + delta + images.length) % images.length;
        onIndexChange?.(next);
        return next;
      });
    },
    [images.length, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  const stop = (e: MouseEvent) => e.stopPropagation();

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      className="fixed inset-0 z-[100] grid place-items-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-95 transition"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <X className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { stop(e); go(-1); }}
            aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-95 transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { stop(e); go(1); }}
            aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-95 transition"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-md"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
          >
            {i + 1} / {images.length}
          </div>
        </>
      )}

      <img
        key={images[i]}
        src={images[i]}
        alt={`Image ${i + 1} of ${images.length}`}
        onClick={stop}
        className="max-h-[92vh] max-w-[96vw] select-none rounded-lg object-contain animate-in zoom-in-95 duration-200"
        draggable={false}
      />
    </div>,
    document.body
  );
}
