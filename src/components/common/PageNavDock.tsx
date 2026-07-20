import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageNavDockProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  isFullscreen?: boolean;
  className?: string;
}

export function PageNavDock({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  isFullscreen = false,
  className,
}: PageNavDockProps) {
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const node = (
    <div
      className={cn(
        "fixed inset-x-0 z-[60] flex justify-center px-3 pointer-events-none",
        className
      )}
      style={{
        // In fullscreen, slide down to where the home dock used to sit (home dock is hidden then).
        bottom: isFullscreen
          ? "calc(env(safe-area-inset-bottom) + 1rem)"
          : "calc(env(safe-area-inset-bottom) + 6.5rem)",
        transform: "none",
        margin: 0,
        padding: "0 12px",
        transition: "bottom 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "bottom",
      }}
      role="navigation"
      aria-label="Page navigation"
    >
      <div
        className={cn(
          "glass rounded-full pointer-events-auto",
          "flex items-center gap-1 h-[60px] px-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
        )}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          aria-label="Previous page"
          className={cn(
            "flex items-center gap-2 h-12 px-4 rounded-full",
            "transition active:scale-95 active:opacity-70",
            prevDisabled && "opacity-30 pointer-events-none"
          )}
        >
          <ChevronLeft className="h-5 w-5 text-neutral-900" strokeWidth={2} />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-neutral-900 font-[Poppins,Inter,sans-serif]">
              Previous
            </span>
            <span className="text-[11px] text-neutral-500">
              Page {Math.max(1, currentPage - 1)}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 px-3 mx-1 h-10 rounded-full bg-neutral-100/80">
          <FileText className="h-4 w-4 text-neutral-600" strokeWidth={2} />
          <span className="text-sm font-semibold tabular-nums text-neutral-800">
            {currentPage} / {totalPages}
          </span>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          aria-label="Next page"
          className={cn(
            "flex items-center gap-2 h-12 px-4 rounded-full",
            "transition active:scale-95 active:opacity-70",
            nextDisabled && "opacity-30 pointer-events-none"
          )}
        >
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-neutral-900 font-[Poppins,Inter,sans-serif]">
              Next
            </span>
            <span className="text-[11px] text-neutral-500">
              Page {Math.min(totalPages, currentPage + 1)}
            </span>
          </div>
          <ChevronRight className="h-5 w-5 text-neutral-900" strokeWidth={2} />
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

export default PageNavDock;
