import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Bookmark, Settings as SettingsIcon, User } from "lucide-react";
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
    { to: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, match: (p: string) => p.startsWith("/bookmarks") },
    { to: "/admin", label: t("nav.admin"), icon: User, match: (p: string) => p.startsWith("/admin") },
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
  ] as const;

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
        <header className="sticky top-0 z-30">
          <div className="glass-strong border-b border-transparent">
            <div className="mx-auto max-w-screen-sm px-4 h-14 flex items-center gap-2">
              {left}
              <h1 className="flex-1 text-base font-semibold truncate">{title}</h1>
              {right}
            </div>
          </div>
        </header>
      ) : null}

      <main className={`flex-1 mx-auto w-full max-w-screen-sm px-4 ${hideNav ? "pb-6" : "pb-28"} animate-fade-up`}>
        {children}
      </main>

      {!hideNav && (
        <nav
          className="fixed inset-x-0 z-40 flex justify-center px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="glass rounded-[28px] w-full max-w-screen-sm">
            <ul className="grid grid-cols-5 px-1.5 py-1.5">
              {items.map((it) => {
                const Active = it.match(pathname);
                const Icon = it.icon;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className={`relative flex flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-medium transition-all ${
                        Active ? "brand-text" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-12 items-center justify-center rounded-2xl transition-all ${
                          Active
                            ? "scale-105 shadow-sm"
                            : ""
                        }`}
                        style={
                          Active
                            ? {
                                background:
                                  "linear-gradient(140deg, color-mix(in oklab, var(--brand) 28%, transparent), color-mix(in oklab, var(--brand) 12%, transparent))",
                              }
                            : undefined
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
