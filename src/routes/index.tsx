import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { OfflineButton } from "../components/OfflineButton";
import { useT, pickLang } from "../lib/i18n";
import { Music, BookOpen, Sparkles } from "lucide-react";
import { getTodaySnap, saveToday, removeOffline, OFFLINE_KEYS } from "../lib/offline";
import type { Book, Song } from "../lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Church Companion — Worship & Library" },
      { name: "description", content: "Today's worship songs and the full church library, in Hindi." },
      { property: "og:title", content: "Church Companion" },
      { property: "og:description", content: "Today's worship songs and the full church library, in Hindi." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    const seen = typeof window !== "undefined" && sessionStorage.getItem("cc.splash");
    if (seen) { setSplash(false); return; }
    const t = setTimeout(() => {
      setSplash(false);
      try { sessionStorage.setItem("cc.splash", "1"); } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  if (splash) return <SplashScreen />;
  return <Home />;
}

function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <img src="/icon-512.png" alt="Church Companion" width={112} height={112} className="rounded-3xl shadow-lg" />
        <p className="text-sm font-medium text-muted-foreground">Church Companion</p>
      </div>
    </div>
  );
}

function Home() {
  const { t, language } = useT();
  const qc = useQueryClient();

  const booksQ = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").order("sort_order");
      if (error) throw error;
      return data as Book[];
    },
  });

  const todayQ = useQuery({
    queryKey: ["today"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: sets, error } = await supabase
        .from("today_song_sets")
        .select("id, title, note, for_date")
        .eq("for_date", today)
        .order("published_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const set = sets?.[0];
      if (!set) return { set: null, items: [] as Song[] };
      const { data: items, error: e2 } = await supabase
        .from("today_song_items")
        .select("position, songs:song_id(*)")
        .eq("set_id", set.id)
        .order("position");
      if (e2) throw e2;
      const songs = (items ?? []).map((r: any) => r.songs).filter(Boolean) as Song[];
      return { set, items: songs };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("today-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "today_song_sets" }, () => qc.invalidateQueries({ queryKey: ["today"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "today_song_items" }, () => qc.invalidateQueries({ queryKey: ["today"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <AppShell>
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
          <div>
            <p className="text-xs text-muted-foreground">{t("home.greeting")}</p>
            <h1 className="text-xl font-bold">{t("app.name")}</h1>
          </div>
        </div>
      </div>

      <section className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 brand-text" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("home.today")}
          </h2>
        </div>
        <Card className="overflow-hidden">
          {todayQ.isLoading ? (
            <div className="p-5 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : !todayQ.data?.set || todayQ.data.items.length === 0 ? (
            <div className="p-6 text-center">
              <Music className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">{t("home.no_today")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {todayQ.data.set.title && (
                <li className="px-4 py-3 brand-bg text-sm font-semibold">
                  {todayQ.data.set.title}
                </li>
              )}
              {todayQ.data.items.map((s, i) => (
                <li key={s.id}>
                  <Link
                    to="/books/song-book/$id"
                    params={{ id: s.id }}
                    className="tap-card flex items-center gap-3 px-4 py-3 hover:bg-accent"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-6 tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{pickLang(s.title_en, s.title_hi, language)}</p>
                      {s.number != null && (
                        <p className="text-xs text-muted-foreground">#{s.number}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-7">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 brand-text" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("home.books")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(booksQ.data ?? []).map((b) => (
            <Link
              key={b.id}
              to={`/books/${b.slug}` as any}
              className="tap-card relative overflow-hidden rounded-2xl p-4 min-h-32 flex flex-col justify-end text-white shadow-md"
              style={{
                background: `linear-gradient(140deg, ${b.accent_color}, ${shade(b.accent_color, -25)})`,
              }}
            >
              <BookOpen className="absolute right-3 top-3 h-5 w-5 opacity-50" />
              <p className="text-[11px] uppercase tracking-wide opacity-80">{b.title_en}</p>
              <p className="font-hi text-base font-semibold leading-tight">{b.title_hi}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function shade(hex: string, percent: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.max(0, Math.min(255, r + Math.round((percent / 100) * 255)));
  g = Math.max(0, Math.min(255, g + Math.round((percent / 100) * 255)));
  b = Math.max(0, Math.min(255, b + Math.round((percent / 100) * 255)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
