// Shared building blocks for every settings-style screen (Settings,
// Diagnostics, Admin security). iOS-style grouped inset lists on glass.

import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Section heading + a grouped glass card holding the rows. */
export function SettingsGroup({
  label,
  hint,
  children,
  className,
  bare = false,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** Render children without the grouped card chrome. */
  bare?: boolean;
}) {
  return (
    <section className="space-y-2">
      {label && (
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </h2>
      )}
      {bare ? (
        <div className={className}>{children}</div>
      ) : (
        <div
          className={cn(
            "glass overflow-hidden rounded-[22px] divide-y divide-border/50",
            className,
          )}
        >
          {children}
        </div>
      )}
      {hint && <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </section>
  );
}

/** Tinted rounded icon tile used at the start of a row. */
export function RowIcon({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "muted" | "danger" }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-[12px] [&>svg]:h-[18px] [&>svg]:w-[18px]",
        tone === "brand" && "brand-bg elev-1",
        tone === "muted" && "bg-secondary text-foreground",
        tone === "danger" && "bg-destructive/12 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

type RowBase = {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

function RowInner({ icon, title, subtitle, trailing }: RowBase) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-medium leading-tight">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {trailing}
    </>
  );
}

const rowCls =
  "flex w-full items-center gap-3 px-4 py-3.5 min-h-[56px] text-left transition-colors";

/** Static row — for rows whose control lives in `trailing`. */
export function SettingsRow(props: RowBase) {
  return (
    <div className={cn(rowCls, props.className)}>
      <RowInner {...props} />
    </div>
  );
}

/** Tappable row that navigates. */
export function SettingsLinkRow({ to, ...props }: RowBase & { to: string }) {
  return (
    <Link
      to={to}
      className={cn(rowCls, "focus-ring active:bg-secondary/60 hover:bg-secondary/40", props.className)}
    >
      <RowInner
        {...props}
        trailing={props.trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      />
    </Link>
  );
}

/** Tappable row that runs an action. */
export function SettingsButtonRow({
  onClick,
  disabled,
  ...props
}: RowBase & { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        rowCls,
        "focus-ring active:bg-secondary/60 hover:bg-secondary/40 disabled:opacity-50",
        props.className,
      )}
    >
      <RowInner {...props} />
    </button>
  );
}

/** Small right-aligned value text for a row. */
export function RowValue({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{children}</span>;
}

/**
 * Sliding segmented control. The active pill is a single absolutely
 * positioned element so switching animates instead of popping.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="relative isolate flex rounded-full bg-secondary/70 p-1"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 -z-10 rounded-full brand-bg elev-1 will-change-transform"
        style={{
          width: `calc(${pct}% - 0.5rem + ${pct / 100} * 0.5rem)`,
          transform: `translate3d(calc(${idx} * (100% + ${(0.5 / options.length).toFixed(4)}rem) + ${idx} * 0px), 0, 0)`,
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 min-h-10 flex-1 rounded-full px-2 text-[13px] font-semibold transition-colors duration-200",
              active ? "text-[color:var(--brand-foreground)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
