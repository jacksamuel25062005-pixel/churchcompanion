import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Bookmark, Settings as SettingsIcon, CalendarDays } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "../lib/i18n";

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
}

// Static match rules — defined once, never re-created per render.
const NAV_MATCHERS = [
  { to: "/", key: "home", icon: Home, match: (p: string) => p === "/" },
  { to: "/search", key: "search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { to: "/almanac", key: "almanac", icon: CalendarDays, match: (p: string) => p.startsWith("/almanac") },
  { to: "/bookmarks", key: "bookmarks", icon: Bookmark, match: (p: string) => p.startsWith("/bookmarks") },
  { to: "/settings", key: "settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
] as const;

function resolveActiveIndex(pathname: string): number {
  for (let i = 0; i < NAV_MATCHERS.length; i++) {
    if (NAV_MATCHERS[i].match(pathname)) return i;
  }
  return -1;
}

/**
 * Dock is isolated so pathname changes only re-render the nav — not the whole
 * shell / route content. Prevents jank on low-end devices during rapid taps.
 */
const DockNav = memo(function DockNav() {
  const { t } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Compute once per pathname; stable identity avoids downstream churn.
  const activeIndex = useMemo(() => resolveActiveIndex(pathname), [pathname]);
  const hasActive = activeIndex >= 0;

  // On first paint, snap the indicator to its target without any glide.
  // After mount, restore the CSS transition so subsequent taps animate.
  const [mounted, setMounted] = useState(false);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    raf.current = requestAnimationFrame(() => setMounted(true));
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  const items = useMemo(
    () => [
      { ...NAV_MATCHERS[0], label: t("nav.home") },
      { ...NAV_MATCHERS[1], label: t("nav.search") },
      { ...NAV_MATCHERS[2], label: t("nav.almanac") },
      { ...NAV_MATCHERS[3], label: t("nav.bookmarks") },
      { ...NAV_MATCHERS[4], label: t("nav.settings") },
    ],
    [t],
  );

  const indicatorStyle = useMemo<React.CSSProperties>(
    () => ({
      width: `calc((100% - 12px) / ${NAV_MATCHERS.length})`,
      // Use CSS var so we only touch a single custom property, not the whole style string.
      ["--dock-i" as any]: Math.max(activeIndex, 0),
      transform: `translate3d(calc(var(--dock-i) * 100%), 0, 0)`,
    }),
    [activeIndex],
  );

  return (
    <nav
      data-app-nav
      className="fixed inset-x-0 z-40 flex justify-center px-3 safe-bottom dock-shell"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="glass dock-pill relative w-full max-w-screen-sm rounded-[28px] overflow-hidden">
        <span
          aria-hidden
          className="dock-indicator"
          data-active={hasActive ? "true" : "false"}
          data-mounted={mounted ? "true" : "false"}
          style={indicatorStyle}
        >
          <span className="dock-indicator-glow" />
        </span>

        <ul className="relative grid grid-cols-5 px-1.5 py-1.5">
          {items.map((it, i) => {
            const Active = i === activeIndex;
            const Icon = it.icon;
            return (
              <li key={it.key}>
                <Link
                  to={it.to}
                  className={`nav-item relative flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-medium ${
                    Active ? "brand-text is-active" : "text-muted-foreground"
                  }`}
                >
                  <span className="nav-icon flex h-9 w-12 items-center justify-center rounded-2xl">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={Active ? 2.4 : 2} />
                  </span>
                  <span className="nav-label leading-none">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
});

export function AppShell({ children, hideNav, title, left, right }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      {/* Ambient orbs — kept light for mid-range GPUs (two fixed layers, no animation) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-24 -left-20 h-[360px] w-[360px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--brand) 50%, transparent), transparent 70%)", transform: "translateZ(0)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--brand) 30%, transparent), transparent 70%)", transform: "translateZ(0)" }}
        />
      </div>

      {title || left || right ? (
        <header className="sticky top-0 z-30 safe-top">
          <div className="glass-strong border-b border-transparent">
            <div className="mx-auto max-w-screen-sm px-4 h-14 flex items-center gap-2">
              {left}
              <h1 className="flex-1 text-base font-semibold truncate">
                <span lang="en">{title}</span>
              </h1>
              {right}
            </div>
          </div>
        </header>
      ) : null}

      <main className={`flex-1 mx-auto w-full max-w-screen-sm px-4 ${hideNav ? "pb-6" : "pb-36"} cc-screen-enter`}>
        {children}
      </main>

      {!hideNav && <DockNav />}
    </div>
  );
}
