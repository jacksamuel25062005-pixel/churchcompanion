import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { useT, pickLang } from "../../lib/i18n";
import { useBrandOverride } from "../../lib/settings";
import { favorites, bookmarks, continueReading } from "../../lib/storage";
import { Heart, Share2, Copy, Bookmark as BookmarkIcon } from "lucide-react";
import { toast } from "sonner";
import type { Book, Song } from "../../lib/types";

export const Route = createFileRoute("/books/song-book/$id")({
  component: SongReader,
});

function SongReader() {
  const { id } = Route.useParams();
  const { t, language } = useT();
  const [tick, setTick] = useState(0);

  const bookQ = useQuery({
    queryKey: ["book", "song-book"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").eq("slug", "song-book").single();
      if (error) throw error;
      return data as Book;
    },
  });
  useBrandOverride(bookQ.data?.accent_color);

  const songQ = useQuery({
    queryKey: ["song", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("songs").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Song;
    },
  });

  useEffect(() => {
    if (!songQ.data) return;
    const s = songQ.data;
    continueReading.set({
      id: s.id,
      kind: "song",
      bookSlug: "song-book",
      title: pickLang(s.title_en, s.title_hi, language) || "",
      at: Date.now(),
    });
  }, [songQ.data, language]);

  if (songQ.isLoading) {
    return <AppShell title="…" left={<BackButton to="/books/song-book" />}><p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p></AppShell>;
  }
  const s = songQ.data!;
  const title = pickLang(s.title_en, s.title_hi, language) || "";
  const fav = favorites.has(s.id);
  const bm = bookmarks.has(s.id);

  const shareText = `${s.number ? `#${s.number} — ` : ""}${title}\n\n${s.lyrics_hi}`;

  const onShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title, text: shareText });
      else { await navigator.clipboard.writeText(shareText); toast.success(t("common.copied")); }
    } catch {}
  };
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(shareText); toast.success(t("common.copied")); } catch {}
  };

  return (
    <AppShell title={title} left={<BackButton to="/books/song-book" />}>
      <div className="pt-4">
        <div className="flex items-center gap-2 text-xs">
          {s.number != null && (
            <span className="rounded-full brand-bg px-2.5 py-1 font-bold">#{s.number}</span>
          )}
          <span className="text-muted-foreground">{t("song.number")}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold font-hi leading-tight">{s.title_hi}</h1>
        {s.title_en && <p className="text-sm text-muted-foreground mt-1">{s.title_en}</p>}

        <div className="mt-4 flex gap-2 flex-wrap">
          <ActionBtn onClick={() => { favorites.toggle(s.id); setTick((x) => x + 1); }} active={fav} icon={<Heart className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />} label={t("common.favorite")} />
          <ActionBtn onClick={() => {
            bookmarks.toggle({ id: s.id, kind: "song", bookSlug: "song-book", title, number: s.number, addedAt: Date.now() });
            setTick((x) => x + 1);
          }} active={bm} icon={<BookmarkIcon className={`h-4 w-4 ${bm ? "fill-current" : ""}`} />} label={t("common.bookmark")} />
          <ActionBtn onClick={onShare} icon={<Share2 className="h-4 w-4" />} label={t("common.share")} />
          <ActionBtn onClick={onCopy} icon={<Copy className="h-4 w-4" />} label={t("common.copy")} />
        </div>

        <Card className="mt-5 p-5">
          <div className="reader-prose font-hi">{s.lyrics_hi}</div>
          {s.lyrics_en && (
            <>
              <hr className="my-5" />
              <div className="reader-prose">{s.lyrics_en}</div>
            </>
          )}
        </Card>
      </div>
      <span className="hidden">{tick}</span>
    </AppShell>
  );
}

function ActionBtn({ onClick, icon, label, active }: { onClick: () => void; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`tap-card inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${active ? "brand-bg brand-border" : "bg-card"}`}
    >
      {icon}{label}
    </button>
  );
}
