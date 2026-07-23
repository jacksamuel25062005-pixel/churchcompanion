import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { OfflineButton } from "../components/OfflineButton";
import { useT, pickLang } from "../lib/i18n";
import { Music, BookOpen, Sparkles, Megaphone, CalendarDays, Info, ChevronRight } from "lucide-react";
import { useTodaySnap, saveToday, removeOffline, OFFLINE_KEYS } from "../lib/offline";
import type { Book, Song } from "../lib/types";
import { AnnouncementModule, AnnouncementBell } from "../components/AnnouncementModule";
import { useExitConfirmation } from "../lib/use-exit-confirmation";

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
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  if (splash) return <SplashScreen />;
  return <Home />;
}

function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <img src="/icon-512.png" alt="Church Companion" width={96} height={96} className="rounded-3xl shadow-2xl gpu" />
        <p className="font-display text-sm font-semibold text-indigo-accent">Church Companion</p>
      </div>
    </div>
  );
}

function greetingKey(): "home.greeting.morning" | "home.greeting.afternoon" | "home.greeting.evening" | "home.greeting" {
  if (typeof window === "undefined") return "home.greeting";
  const h = new Date().getHours();
  if (h < 12) return "home.greeting.morning";
  if (h < 17) return "home.greeting.afternoon";
  return "home.greeting.evening";
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

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const books = (booksQ.data ?? []).filter((b) => b.slug !== "almanac");
  const [featuredBook, ...restBooks] = books;

  const gKey = greetingKey();
  const greetingEn = gKey === "home.greeting.morning" ? "Good Morning"
    : gKey === "home.greeting.afternoon" ? "Good Afternoon"
    : gKey === "home.greeting.evening" ? "Good Evening" : t("home.greeting");
  const greetingHi = gKey === "home.greeting.morning" ? "शुभ प्रभात"
    : gKey === "home.greeting.afternoon" ? "नमस्ते" : "शुभ संध्या";

  return (
    <AppShell>
      {/* Greeting hero */}
      <header className="pt-6 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-bold tracking-tight leading-tight">
            {greetingEn}
            <br />
            <span className="text-indigo-accent font-hi">{greetingHi}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-medium">{dateLabel}</p>
        </div>
        <div className="shrink-0 pt-1"><AnnouncementBell /></div>
      </header>

      {/* Top bento: Announcements + Today's Songs */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/bookmarks" className="bento-tile p-4 min-h-[130px] flex flex-col gpu">
          <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: "color-mix(in oklab, var(--primary) 22%, transparent)" }}>
            <Megaphone className="h-4 w-4 text-indigo-accent" />
          </div>
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">Announcements</h3>
          <div className="mt-2 flex-1 min-h-0 overflow-hidden text-[11px] text-white/50">
            <AnnouncementCompact />
          </div>
        </Link>

        <div className="bento-tile bento-tile-accent p-4 min-h-[130px] flex flex-col gpu">
          <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-white/15">
            <Music className="h-4 w-4" />
          </div>
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/90">{t("home.today")}</h3>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-[11px] text-white/85">
              {todayQ.data?.items?.length ? `${todayQ.data.items.length} ${todayQ.data.items.length === 1 ? "hymn" : "hymns"}` : t("home.no_today")}
            </p>
            <OfflineButton
              storageKey={OFFLINE_KEYS.today()}
              label=""
              onDownload={handleDownloadToday}
              onRemove={() => removeOffline(OFFLINE_KEYS.today())}
            />
          </div>
        </div>
      </section>

      {/* Today's songs list (only when populated) */}
      {todayQ.data?.set && todayQ.data.items.length > 0 && (
        <section className="mt-3">
          <div className="bento-tile p-2 gpu">
            {todayQ.data.set.title && (
              <div className="px-3 py-2 rounded-2xl text-sm font-semibold" style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}>
                {todayQ.data.set.title}
              </div>
            )}
            <ul className="mt-1 divide-y divide-white/5">
              {todayQ.data.items.map((s, i) => (
                <li key={s.id}>
                  <Link
                    to="/books/song-book/$id"
                    params={{ id: s.id }}
                    className="tap-card flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5"
                  >
                    <span className="text-xs font-bold text-indigo-accent w-6 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{pickLang(s.title_en, s.title_hi, language)}</p>
                      {s.number != null && (
                        <p className="text-[11px] text-white/45">#{s.number}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Books bento */}
      <section className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-indigo-accent" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">{t("home.books")}</h2>
        </div>

        {booksQ.isLoading && !books.length ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bento-tile h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {featuredBook && (
              <Link
                to={`/books/${featuredBook.slug}` as any}
                className="bento-tile bento-tile-featured col-span-2 h-40 p-6 flex flex-col justify-end gpu"
              >
                <div aria-hidden className="absolute -top-16 -right-8 h-56 w-56 rounded-full blur-3xl opacity-40"
                  style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 70%, transparent), transparent 70%)" }} />
                <span className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-2xl bg-white/10 border border-white/10">
                  <BookOpen className="h-4 w-4" />
                </span>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{featuredBook.title_en}</p>
                <h3 className="font-display text-2xl font-bold leading-tight mt-1">
                  <span className="font-hi text-indigo-accent">{featuredBook.title_hi}</span>
                </h3>
              </Link>
            )}

            {restBooks.map((b) => (
              <Link
                key={b.id}
                to={`/books/${b.slug}` as any}
                className="bento-tile h-36 p-5 flex flex-col justify-between gpu"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "color-mix(in oklab, var(--primary) 20%, transparent)" }}>
                  <BookOpen className="h-4 w-4 text-indigo-accent" />
                </div>
                <div className="leading-tight">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">{b.title_en}</p>
                  <p className="font-hi text-sm font-semibold text-white mt-0.5">{b.title_hi}</p>
                </div>
              </Link>
            ))}

            <Link
              to="/about"
              className="bento-tile h-36 p-5 flex flex-col justify-between gpu"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "color-mix(in oklab, var(--primary) 20%, transparent)" }}>
                <Info className="h-4 w-4 text-indigo-accent" />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">About</p>
                <p className="font-hi text-sm font-semibold text-white mt-0.5">कलीसिया के बारे में</p>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* Almanac banner */}
      <section className="mt-5">
        <Link to="/almanac" className="bento-tile bento-tile-featured p-5 flex items-center justify-between gap-4 gpu">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold leading-tight">Almanac</h3>
            <p className="text-[11px] text-white/60 mt-0.5">Daily Liturgical Guide • <span className="font-hi">पंचांग</span></p>
          </div>
          <div className="shrink-0 grid h-14 w-14 place-items-center rounded-2xl border" style={{ borderColor: "color-mix(in oklab, var(--primary) 40%, transparent)", background: "color-mix(in oklab, var(--primary) 15%, transparent)" }}>
            <div className="text-center leading-none">
              <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-accent">{today.toLocaleDateString(undefined, { month: "short" })}</div>
              <div className="mt-0.5 font-display text-lg font-bold">{today.getDate()}</div>
            </div>
          </div>
          <CalendarDays className="h-5 w-5 text-indigo-accent shrink-0" />
        </Link>
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-indigo-accent" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Announcements</h2>
        </div>
        <AnnouncementModule />
      </section>
    </AppShell>
  );
}

/** Tiny inline preview of the latest announcement for the top bento tile. */
function AnnouncementCompact() {
  return <span className="line-clamp-2">Tap for latest updates from the church.</span>;
}
