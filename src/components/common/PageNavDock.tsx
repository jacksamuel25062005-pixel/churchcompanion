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

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-50 flex justify-center px-3 safe-bottom pointer-events-none",
        className
      )}
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
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
        {/* Previous */}
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

        {/* Center indicator */}
        <div className="flex items-center gap-1.5 px-3 mx-1 h-10 rounded-full bg-neutral-100/80">
          <FileText className="h-4 w-4 text-neutral-600" strokeWidth={2} />
          <span className="text-sm font-semibold tabular-nums text-neutral-800">
            {currentPage} / {totalPages}
          </span>
        </div>

        {/* Next */}
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
}

export default PageNavDock;
