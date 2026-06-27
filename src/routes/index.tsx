import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { OfflineButton } from "../components/OfflineButton";
import { useT, pickLang } from "../lib/i18n";
import { Music, BookOpen, Sparkles } from "lucide-react";
import { useTodaySnap, saveToday, removeOffline, OFFLINE_KEYS } from "../lib/offline";
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

  const todaySnap = useTodaySnap();
  const todayDate = new Date().toISOString().slice(0, 10);

  const todayQ = useQuery({
    queryKey: ["today"],
    initialData:
      todaySnap && todaySnap.for_date === todayDate
        ? { set: todaySnap.set, items: todaySnap.items }
        : undefined,
    queryFn: async () => {
      const { data: sets, error } = await supabase
        .from("today_song_sets")
        .select("id, title, note, for_date")
        .eq("for_date", todayDate)
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
    if (!todayQ.data?.set) return;
    if (!todaySnap) return;
    void saveToday({
      set: todayQ.data.set as any,
      items: todayQ.data.items,
      at: Date.now(),
      for_date: todayDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayQ.data]);

  const handleDownloadToday = async () => {
    if (!todayQ.data?.set) throw new Error("No songs published for today yet");
    await saveToday({
      set: todayQ.data.set as any,
      items: todayQ.data.items,
      at: Date.now(),
      for_date: todayDate,
    });
  };

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
          <div className="ml-auto">
            <OfflineButton
              storageKey={OFFLINE_KEYS.today()}
              label="Save today"
              onDownload={handleDownloadToday}
              onRemove={() => removeOffline(OFFLINE_KEYS.today())}
            />
          </div>
        </div>
        <Card className="overflow-hidden">
          {todayQ.isLoading && !todayQ.data ? (
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
              className="tap-card relative overflow-hidden rounded-[22px] min-h-36 text-white shadow-md isolate"
              style={{
                background: `linear-gradient(140deg, ${b.accent_color}, ${shade(b.accent_color, -25)})`,
              }}
            >
              {/* Pebble noise texture */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
                  backgroundSize: "180px 180px",
                }}
              />
              {/* Frosted glass pebble panel */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 inset-y-3 rounded-[18px] border border-white/25"
                style={{
                  background:
                    "radial-gradient(120% 100% at 20% 0%, rgba(255,255,255,0.35), rgba(255,255,255,0.08) 60%, rgba(255,255,255,0.04))",
                  backdropFilter: "blur(28px) saturate(160%)",
                  WebkitBackdropFilter: "blur(28px) saturate(160%)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.1), 0 8px 24px -12px rgba(0,0,0,0.35)",
                }}
              />
              <BookOpen className="absolute right-4 top-4 h-5 w-5 opacity-80 z-10" />
              <div className="relative z-10 flex h-full min-h-36 flex-col items-center justify-center px-4 text-center">
                <p
                  className="text-lg font-extrabold leading-tight tracking-tight drop-shadow-sm"
                  style={{ fontFamily: "'Fraunces', 'Manrope', serif", fontOpticalSizing: "auto" } as any}
                >
                  {b.title_en}
                </p>
                <p className="font-hi mt-1 text-[11px] font-medium opacity-80">{b.title_hi}</p>
              </div>
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
