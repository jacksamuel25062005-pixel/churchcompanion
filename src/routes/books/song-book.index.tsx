import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, EmptyState } from "../../components/ui-bits";
import { OfflineButton } from "../../components/OfflineButton";
import { useT, pickLang } from "../../lib/i18n";
import { useBrandOverride } from "../../lib/settings";
import {
  getSongBookSnap,
  saveSongBook,
  removeOffline,
  OFFLINE_KEYS,
} from "../../lib/offline";
import { Search as SearchIcon } from "lucide-react";
import type { Book, Song } from "../../lib/types";

export const Route = createFileRoute("/books/song-book/")({
  head: () => ({
    meta: [
      { title: "Song Book — Church Companion" },
      { name: "description", content: "Search and read Hindi worship songs from the church Song Book." },
      { property: "og:title", content: "Song Book — Church Companion" },
      { property: "og:description", content: "Search and read Hindi worship songs." },
    ],
  }),
  component: SongList,
});

function SongList() {
  const { t, language } = useT();
  const [q, setQ] = useState("");
  const snap = typeof window !== "undefined" ? getSongBookSnap() : null;

  const bookQ = useQuery({
    queryKey: ["book", "song-book"],
    initialData: snap?.book,
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").eq("slug", "song-book").single();
      if (error) throw error;
      return data as Book;
    },
  });
  useBrandOverride(bookQ.data?.accent_color);

  const songsQ = useQuery({
    queryKey: ["songs"],
    initialData: snap?.songs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Song[];
    },
  });

  // Refresh the offline snapshot when both book + songs are loaded fresh.
  useEffect(() => {
    if (!bookQ.data || !songsQ.data) return;
    if (!snap) return; // only auto-refresh when user opted in
    saveSongBook({ book: bookQ.data, songs: songsQ.data, at: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookQ.data, songsQ.data]);

  const filtered = useMemo(() => {
    const list = songsQ.data ?? [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((s) =>
      String(s.number ?? "").includes(needle) ||
      (s.title_hi ?? "").toLowerCase().includes(needle) ||
      (s.title_en ?? "").toLowerCase().includes(needle) ||
      (s.lyrics_hi ?? "").toLowerCase().includes(needle) ||
      (s.lyrics_en ?? "").toLowerCase().includes(needle),
    );
  }, [songsQ.data, q]);

  const handleDownload = async () => {
    let book = bookQ.data;
    let songs = songsQ.data;
    if (!book) {
      const { data, error } = await supabase.from("books").select("*").eq("slug", "song-book").single();
      if (error) throw error;
      book = data as Book;
    }
    if (!songs) {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      songs = data as Song[];
    }
    saveSongBook({ book: book!, songs: songs!, at: Date.now() });
  };

  return (
    <AppShell
      title={pickLang(bookQ.data?.title_en, bookQ.data?.title_hi, language) ?? "Song Book"}
      left={<BackButton to="/" />}
    >
      <div className="pt-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("song.search_ph")}
            className="w-full pl-10 pr-3 py-3 rounded-xl bg-secondary text-sm outline-none focus:ring-2 brand-ring"
            inputMode="search"
          />
        </div>
        <div className="mt-3">
          <OfflineButton
            storageKey={OFFLINE_KEYS.songBook()}
            onDownload={handleDownload}
            onRemove={() => removeOffline(OFFLINE_KEYS.songBook())}
          />
        </div>
      </div>

      <div className="mt-4">
        {songsQ.isLoading && !songsQ.data ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <EmptyState title={t("common.empty")} hint="Admins can upload songs from the Admin section." />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card overflow-hidden">
            {filtered.map((s) => (
              <li key={s.id}>
                <Link
                  to="/books/song-book/$id"
                  params={{ id: s.id }}
                  className="tap-card flex items-center gap-3 px-4 py-3 hover:bg-accent"
                >
                  <span className="w-9 text-right tabular-nums text-xs font-bold brand-text">
                    {s.number ?? "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate font-hi">{pickLang(s.title_en, s.title_hi, language)}</p>
                    {s.title_en && s.title_hi && language === "hi" && (
                      <p className="text-xs text-muted-foreground truncate">{s.title_en}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
