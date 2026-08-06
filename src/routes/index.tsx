import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { OfflineButton } from "../components/OfflineButton";
import { useT, pickLang } from "../lib/i18n";
import { Music, BookOpen, Sparkles, Megaphone, CalendarDays, MessagesSquare, Bookmark } from "lucide-react";
import { useTodaySnap, saveToday, removeOffline, OFFLINE_KEYS } from "../lib/offline";
import type { Book, Song } from "../lib/types";
import { AnnouncementModule, AnnouncementBell } from "../components/AnnouncementModule";
import { StainedGlass } from "../components/StainedGlass";
import { useExitConfirmation } from "../lib/use-exit-confirmation";
import { IOS_SPRING, IOS_SPRING_SNAP, STAGGER_FADE, staggerContainer } from "../lib/motion";

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
  useExitConfirmation(!splash);
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

  const today = todayQ.data;
  const songCount = today?.items.length ?? 0;
  const books = (booksQ.data ?? []).filter((b) => b.slug !== "almanac");

  return (
    <AppShell>
      {/* Hero */}
      <motion.section
        className="relative mt-4 overflow-hidden rounded-[28px] elev-1"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={IOS_SPRING}
        style={{ background: "linear-gradient(150deg, color-mix(in oklab, var(--lit-purple) 16%, var(--card)) 0%, color-mix(in oklab, var(--lit-gold) 10%, var(--card)) 100%)" }}
      >
        <StainedGlass variant="hero" />
        <div className="relative flex items-center gap-3 px-4 py-5">
          <img src="/icon-192.png" alt="" width={44} height={44} className="rounded-2xl elev-1 lit-ring-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-muted-foreground">{t("home.greeting")}</p>
            <h1 className="font-display text-[22px] font-bold leading-tight truncate">{t("app.name")}</h1>
          </div>
          <AnnouncementBell />
        </div>
      </motion.section>

      {/* Bento: featured Today tile + two accent tiles */}
      <motion.section
        className="mt-4 grid grid-cols-2 gap-3"
        variants={staggerContainer(0.06)}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={STAGGER_FADE} whileTap={{ scale: 0.97 }} transition={IOS_SPRING_SNAP} className="col-span-2">
          <Link
            to="/books/song-book"
            className="tap-card relative flex min-h-36 flex-col justify-between overflow-hidden rounded-[26px] p-4 text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in oklab, var(--lit-purple) 70%, #1b1052))" }}
          >
            <StainedGlass variant="hero" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-85">{t("home.today")}</p>
                <p className="mt-1 font-display text-[20px] font-bold leading-tight">
                  {today?.set?.title ?? (songCount ? `${songCount} songs ready` : t("home.no_today"))}
                </p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
            </div>
            <div className="relative mt-3 flex flex-wrap gap-1.5">
              {(today?.items ?? []).slice(0, 3).map((s) => (
                <span key={s.id} className="max-w-full truncate rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
                  {pickLang(s.title_en, s.title_hi, language)}
                </span>
              ))}
              {songCount > 3 && (
                <span className="rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">+{songCount - 3}</span>
              )}
            </div>
          </Link>
        </motion.div>

        <motion.div variants={STAGGER_FADE} whileTap={{ scale: 0.97 }} transition={IOS_SPRING_SNAP}>
          <Link
            to="/almanac"
            className="tap-card flex min-h-28 flex-col justify-end rounded-[24px] border border-border/60 bg-card p-4 elev-1"
          >
            <CalendarDays className="mb-2 h-5 w-5 brand-text" />
            <p className="text-[15px] font-semibold leading-tight">{t("nav.almanac")}</p>
            <p className="text-[11px] text-muted-foreground">Daily readings</p>
          </Link>
        </motion.div>

        <motion.div variants={STAGGER_FADE} whileTap={{ scale: 0.97 }} transition={IOS_SPRING_SNAP}>
          <Link
            to="/chat"
            className="tap-card flex min-h-28 flex-col justify-end rounded-[24px] border border-border/60 bg-card p-4 elev-1"
          >
            <MessagesSquare className="mb-2 h-5 w-5 gold-highlight" />
            <p className="text-[15px] font-semibold leading-tight">Chat</p>
            <p className="text-[11px] text-muted-foreground">Congregation & youth</p>
          </Link>
        </motion.div>
      </motion.section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Megaphone className="h-4 w-4 brand-text" />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Announcements</h2>
        </div>
        <AnnouncementModule />
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Music className="h-4 w-4 gold-highlight" />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
        <Card className="overflow-hidden rounded-[24px]">
          {todayQ.isLoading && !today ? (
            <div className="p-5 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : !today?.set || songCount === 0 ? (
            <div className="p-6 text-center">
              <Music className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">{t("home.no_today")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {today.items.map((s, i) => (
                <li key={s.id}>
                  <Link
                    to="/books/song-book/$id"
                    params={{ id: s.id }}
                    className="tap-card flex items-center gap-3 px-4 py-3 hover:bg-accent"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{pickLang(s.title_en, s.title_hi, language)}</p>
                      {s.number != null && <p className="text-xs text-muted-foreground">#{s.number}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen className="h-4 w-4 brand-text" />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("home.books")}</h2>
        </div>
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={staggerContainer(0.06)}
          initial="initial"
          animate="animate"
        >
          {books.map((b, i) => (
            <motion.div
              key={b.id}
              variants={STAGGER_FADE}
              whileTap={{ scale: 0.97 }}
              transition={IOS_SPRING_SNAP}
              className={i === 0 ? "col-span-2" : undefined}
            >
              <Link
                to={`/books/${b.slug}` as any}
                className={`tap-card relative flex flex-col justify-end overflow-hidden rounded-[24px] p-4 text-white shadow-md ${i === 0 ? "min-h-28" : "min-h-32"}`}
                style={{ background: `linear-gradient(140deg, ${b.accent_color}, ${shade(b.accent_color, -25)})` }}
              >
                <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <BookOpen className="h-3.5 w-3.5 opacity-90" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{b.title_en}</p>
                <p className="font-hi text-base font-semibold leading-tight">{b.title_hi}</p>
              </Link>
            </motion.div>
          ))}

          <motion.div variants={STAGGER_FADE} whileTap={{ scale: 0.97 }} transition={IOS_SPRING_SNAP}>
            <Link
              to="/about"
              className="tap-card relative flex min-h-32 flex-col justify-end overflow-hidden rounded-[24px] p-4 text-white shadow-md"
              style={{ background: "linear-gradient(140deg, #7C3AED, #4C1D95)" }}
            >
              <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-xl bg-white/20 backdrop-blur-sm">
                <BookOpen className="h-3.5 w-3.5 opacity-90" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">About</p>
              <p className="font-hi text-base font-semibold leading-tight">कलीसिया के बारे में</p>
            </Link>
          </motion.div>

          <motion.div variants={STAGGER_FADE} whileTap={{ scale: 0.97 }} transition={IOS_SPRING_SNAP}>
            <Link
              to="/bookmarks"
              className="tap-card flex min-h-32 flex-col justify-end rounded-[24px] border border-border/60 bg-card p-4 elev-1"
            >
              <Bookmark className="mb-2 h-5 w-5 brand-text" />
              <p className="text-[15px] font-semibold leading-tight">{t("nav.bookmarks")}</p>
              <p className="text-[11px] text-muted-foreground">Saved songs & sections</p>
            </Link>
          </motion.div>
        </motion.div>
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
