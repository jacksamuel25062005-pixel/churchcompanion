import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui-bits";
import { useT } from "../lib/i18n";
import { bookmarks, continueReading, type Bookmark, type ContinueItem } from "../lib/storage";
import { Trash2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({ meta: [{ title: "Bookmarks — Church Companion" }] }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { t } = useT();
  const [list, setList] = useState<Bookmark[]>([]);
  const [cont, setCont] = useState<ContinueItem | null>(null);
  useEffect(() => {
    const refresh = () => { setList(bookmarks.list()); setCont(continueReading.get()); };
    refresh();
    window.addEventListener("cc:storage", refresh);
    return () => window.removeEventListener("cc:storage", refresh);
  }, []);

  return (
    <AppShell title={t("nav.bookmarks")}>
      {cont && (
        <section className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Continue reading</h2>
          <Link
            to={cont.kind === "song" ? "/books/song-book/$id" : "/books/$slug"}
            params={cont.kind === "song" ? { id: cont.id } : { slug: cont.bookSlug }}
            className="tap-card flex items-center gap-3 rounded-2xl border bg-card p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium font-hi truncate">{cont.title}</p>
              <p className="text-xs text-muted-foreground">{cont.bookSlug}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Saved</h2>
        {list.length === 0 ? (
          <EmptyState title="No bookmarks yet" hint="Tap the bookmark icon while reading." />
        ) : (
          <ul className="space-y-2">
            {list.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <Link
                  to={b.kind === "song" ? "/books/song-book/$id" : "/books/$slug"}
                  params={b.kind === "song" ? { id: b.id } : { slug: b.bookSlug }}
                  className="tap-card flex-1 flex items-center gap-3 rounded-2xl border bg-card p-3.5"
                >
                  {b.number != null && (
                    <span className="rounded-full brand-bg px-2 py-0.5 text-xs font-bold">#{b.number}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium font-hi truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.bookSlug}</p>
                  </div>
                </Link>
                <button
                  onClick={() => { bookmarks.remove(b.id); setList(bookmarks.list()); }}
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent"
                  aria-label="Remove bookmark"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
