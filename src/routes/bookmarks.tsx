import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui-bits";
import { useT } from "../lib/i18n";
import { bookmarks, continueReading, type Bookmark, type ContinueItem } from "../lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, ArrowRight, Bookmark as BookmarkIcon } from "lucide-react";


export const Route = createFileRoute("/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — Church Companion" },
      { name: "description", content: "Your saved songs and book sections, kept on this device and available offline." },
      { property: "og:title", content: "Bookmarks — Church Companion" },
      { property: "og:description", content: "Songs and sections you saved for quick access." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://churchcompanion.lovable.app/bookmarks" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://churchcompanion.lovable.app/bookmarks" }],
  }),
  component: BookmarksPage,
});

async function pruneStaleBookmarks(list: Bookmark[]): Promise<Bookmark[]> {
  if (list.length === 0) return list;
  const songIds = list.filter((b) => b.kind === "song").map((b) => b.id);
  const sectionIds = list.filter((b) => b.kind === "section").map((b) => b.id);
  const valid = new Set<string>();
  try {
    if (songIds.length) {
      const { data } = await supabase.from("songs").select("id").in("id", songIds);
      data?.forEach((r: any) => valid.add(r.id));
    }
    if (sectionIds.length) {
      const { data } = await supabase.from("book_sections").select("id").in("id", sectionIds);
      data?.forEach((r: any) => valid.add(r.id));
    }
  } catch {
    // Network/offline: don't prune — keep current list.
    return list;
  }
  const kept = list.filter((b) => valid.has(b.id));
  if (kept.length !== list.length) {
    list.filter((b) => !valid.has(b.id)).forEach((b) => bookmarks.remove(b.id));
  }
  return kept;
}

async function pruneContinue(c: ContinueItem | null): Promise<ContinueItem | null> {
  if (!c) return null;
  try {
    const table = c.kind === "song" ? "songs" : "book_sections";
    const { data } = await supabase.from(table).select("id").eq("id", c.id).maybeSingle();
    if (!data) { continueReading.clear(); return null; }
    return c;
  } catch {
    return c;
  }
}

function BookmarksPage() {
  const { t } = useT();
  const [list, setList] = useState<Bookmark[]>([]);
  const [cont, setCont] = useState<ContinueItem | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const raw = bookmarks.list();
      const rawCont = continueReading.get();
      // Show local data immediately, then prune async.
      if (alive) { setList(raw); setCont(rawCont); }
      const [pruned, prunedCont] = await Promise.all([
        pruneStaleBookmarks(raw),
        pruneContinue(rawCont),
      ]);
      if (alive) { setList(pruned); setCont(prunedCont); }
    };
    refresh();
    const handler = () => refresh();
    window.addEventListener("cc:storage", handler);
    return () => { alive = false; window.removeEventListener("cc:storage", handler); };
  }, []);

  return (
    <AppShell title={t("nav.bookmarks")}>
      {cont && (
        <section className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Continue reading</h2>
          <Link
            to={cont.kind === "song" ? "/books/song-book/$id" : "/books/$slug"}
            params={cont.kind === "song" ? { id: cont.id } : { slug: cont.bookSlug }}
            className="premium-card tap-card focus-ring flex items-center gap-3 hover:bg-secondary/40"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold font-hi truncate">{cont.title}</p>
              <p className="text-xs text-muted-foreground">{cont.bookSlug}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </section>
      )}

      <section className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Saved</h2>
        {list.length === 0 ? (
          <EmptyState
            title="No bookmarks yet"
            hint="While reading, tap the bookmark icon in the top-right — saved items appear here for quick return."
            icon={<BookmarkIcon className="h-5 w-5" />}
          />
        ) : (
          <ul className="space-y-2">
            {list.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <Link
                  to={b.kind === "song" ? "/books/song-book/$id" : "/books/$slug"}
                  params={b.kind === "song" ? { id: b.id } : { slug: b.bookSlug }}
                  className="premium-card tap-card focus-ring flex-1 flex items-center gap-3 hover:bg-secondary/40"
                >
                  {b.number != null && (
                    <span className="rounded-full brand-bg px-2 py-0.5 text-xs font-bold">#{b.number}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold font-hi truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.bookSlug}</p>
                  </div>
                </Link>
                <button
                  onClick={() => { bookmarks.remove(b.id); setList(bookmarks.list()); }}
                  className="focus-ring grid place-items-center h-11 w-11 rounded-full glass-chip text-muted-foreground"
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
