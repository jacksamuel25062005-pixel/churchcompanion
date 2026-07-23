import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Bookmark, Settings as SettingsIcon, CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../lib/i18n";

interface Props {
  children: ReactNode;
  hideNav?: boolean;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
}

export function AppShell({ children, hideNav, title, left, right }: Props) {
  const { t } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: t("nav.home"), icon: Home, match: (p: string) => p === "/" },
    { to: "/search", label: t("nav.search"), icon: Search, match: (p: string) => p.startsWith("/search") },
    { to: "/almanac", label: t("nav.almanac"), icon: CalendarDays, match: (p: string) => p.startsWith("/almanac") },
    { to: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, match: (p: string) => p.startsWith("/bookmarks") },
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      {/* Ambient indigo halos — cheap, static, GPU-composited */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden gpu">
        <div
          className="absolute -top-32 -left-24 h-[380px] w-[380px] rounded-full opacity-35 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 60%, transparent), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-6rem] right-[-4rem] h-[340px] w-[340px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 40%, transparent), transparent 70%)" }}
        />
      </div>

      {title || left || right ? (
        <header className="sticky top-0 z-30 safe-top">
          <div className="dock-pill !rounded-none border-x-0 border-t-0">
            <div className="mx-auto max-w-screen-sm px-4 h-14 flex items-center gap-2">
              {left}
              <h1 className="flex-1 font-display text-base font-semibold truncate">
                <span lang="en">{title}</span>
              </h1>
              {right}
            </div>
          </div>
        </header>
      ) : null}

      <main className={`flex-1 mx-auto w-full max-w-screen-sm px-4 ${hideNav ? "pb-6" : "pb-32"} cc-screen-enter`}>
        {children}
      </main>

      {!hideNav && (
        <nav
          data-app-nav
          className="fixed inset-x-0 z-40 flex justify-center px-4 safe-bottom"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)", transition: "transform 260ms cubic-bezier(0.22,1,0.36,1)" }}
        >
          <div className="dock-pill w-full max-w-[380px]">
            <ul className="grid grid-cols-5 px-1 py-1">
              {items.map((it) => {
                const Active = it.match(pathname);
                const Icon = it.icon;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                        Active ? "text-white" : "text-white/45 hover:text-white/70"
                      }`}
                    >
                      <span
                        className="flex h-9 w-12 items-center justify-center rounded-full transition-transform duration-[220ms] ease-out"
                        style={
                          Active
                            ? {
                                background:
                                  "linear-gradient(140deg, color-mix(in oklab, var(--primary) 90%, transparent), color-mix(in oklab, var(--primary) 55%, transparent))",
                                boxShadow: "0 0 18px -2px color-mix(in oklab, var(--primary) 65%, transparent)",
                                transform: "translateZ(0) scale(1.05)",
                              }
                            : { transform: "translateZ(0)" }
                        }
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="leading-none">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      )}
    </div>
  );
}
