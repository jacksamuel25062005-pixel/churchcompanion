import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { type MouseEvent, type ReactNode } from "react";

// Records the history index when the app first mounted this session, so we
// know whether "back" would land inside our app or exit it.
let initialHistoryIdx: number | null = null;
if (typeof window !== "undefined") {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  initialHistoryIdx = typeof idx === "number" ? idx : 0;
}

export function BackButton({ to = "/", label }: { to?: string; label?: string }) {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let modifier clicks (cmd/ctrl/shift/middle) open in new tabs.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (typeof window === "undefined") return;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    const base = initialHistoryIdx ?? 0;
    // Only pop if there's a real in-app previous entry to return to.
    if (idx > base) {
      e.preventDefault();
      router.history.back();
    }
    // Otherwise fall through to the <Link>'s normal push to the fallback route.
  };

  return (
    <Link
      to={to}
      onClick={onClick}
      className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent"
    >
      <ChevronLeft className="h-5 w-5" />
      {label}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl text-card-foreground ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs">{hint}</p>}
    </div>
  );
}
