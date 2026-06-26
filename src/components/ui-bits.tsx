import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function BackButton({ to = "/", label }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">
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
