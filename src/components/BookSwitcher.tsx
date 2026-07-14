// Floating book-switcher shown above the bottom dock on book routes.
// Gives one-tap access to the 4 primary books.

import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

interface BookLink {
  slug: string;
  to: string;
  label: string;
  hi: string;
  color: string;
}

const BOOKS: BookLink[] = [
  { slug: "song-book",     to: "/books/song-book",     label: "Songs",       hi: "गीत",           color: "#2563EB" },
  { slug: "lords-supper",  to: "/books/lords-supper",  label: "Lord's Supper", hi: "प्रभु-भोज",     color: "#7C3AED" },
  { slug: "ashaya-rabbani",to: "/books/ashaya-rabbani",label: "Ashaya Rabbani", hi: "आशय रब्बानी",  color: "#DC2626" },
  { slug: "prata-sayan",   to: "/books/prata-sayan",   label: "Prata / Sayan",  hi: "प्रातः/सायं",   color: "#059669" },
];

function isBookRoute(pathname: string) {
  return pathname.startsWith("/books/") || pathname === "/books";
}

export function BookSwitcher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!isBookRoute(pathname)) return null;

  return (
    <div
      className="fixed inset-x-0 z-30 flex justify-center px-3 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
    >
      <div className="glass rounded-full w-full max-w-screen-sm pointer-events-auto shadow-lg">
        <ul className="grid grid-cols-4 gap-1 p-1.5">
          {BOOKS.map((b) => {
            const active =
              pathname === b.to ||
              pathname.startsWith(b.to + "/") ||
              pathname.startsWith(b.to + ".");
            return (
              <li key={b.slug}>
                <Link
                  to={b.to as any}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold transition-all"
                  style={
                    active
                      ? {
                          background: `linear-gradient(140deg, ${b.color}, ${b.color}cc)`,
                          color: "white",
                        }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="leading-none truncate max-w-[72px]">{b.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
