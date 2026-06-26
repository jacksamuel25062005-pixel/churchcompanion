import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Bookmark, Settings as SettingsIcon, User } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../lib/i18n";

interface Props {
  children: ReactNode;
  /** Hide bottom nav (e.g. in admin pages or auth) */
  hideNav?: boolean;
  /** Page title shown in topbar */
  title?: string;
  /** Optional left action (back button etc.) */
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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Ambient glass tint */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(80% 50% at 10% 0%, color-mix(in oklab, var(--brand) 22%, transparent) 0%, transparent 60%), radial-gradient(60% 40% at 100% 10%, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)",
        }}
      />

      {title || left || right ? (
        <header
          className="sticky top-0 z-30 border-b border-border/40 bg-background/60"
          style={{ backdropFilter: "blur(24px) saturate(160%)" }}
        >
          <div className="mx-auto max-w-screen-sm px-4 h-14 flex items-center gap-2">
            {left}
            <h1 className="flex-1 text-base font-semibold truncate">{title}</h1>
            {right}
          </div>
        </header>
      ) : null}

      <main className={`flex-1 mx-auto w-full max-w-screen-sm px-4 ${hideNav ? "pb-6" : "pb-28"}`}>
        {children}
      </main>

      {!hideNav && (
        <nav
          className="fixed inset-x-0 z-40 flex justify-center px-3"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 0.5rem)",
          }}
        >
          <div
            className="w-full max-w-screen-sm rounded-[28px] border border-white/15 bg-background/60 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
            style={{
              backdropFilter: "blur(28px) saturate(180%)",
            }}
          >
            <ul className="grid grid-cols-5 px-1 py-1">
              {items.map((it) => {
                const Active = it.match(pathname);
                const Icon = it.icon;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className={`relative flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition-all ${
                        Active ? "brand-text" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-12 items-center justify-center rounded-2xl transition-all ${
                          Active
                            ? "bg-[color:color-mix(in_oklab,var(--brand)_18%,transparent)] scale-105"
                            : ""
                        }`}
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
