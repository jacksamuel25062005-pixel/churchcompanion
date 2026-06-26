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
      {title || left || right ? (
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b">
          <div className="mx-auto max-w-screen-sm px-4 h-14 flex items-center gap-2">
            {left}
            <h1 className="flex-1 text-base font-semibold truncate">{title}</h1>
            {right}
          </div>
        </header>
      ) : null}

      <main className={`flex-1 mx-auto w-full max-w-screen-sm px-4 ${hideNav ? "pb-6" : "pb-24"}`}>
        {children}
      </main>

      {!hideNav && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur border-t"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="mx-auto max-w-screen-sm grid grid-cols-5">
            {items.map((it) => {
              const Active = it.match(pathname);
              const Icon = it.icon;
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                      Active ? "brand-text" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
