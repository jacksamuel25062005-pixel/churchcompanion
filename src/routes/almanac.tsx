import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Folder,
  FolderOpen,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card, EmptyState } from "../components/ui-bits";
import { StainedGlass } from "../components/StainedGlass";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/almanac")({
  head: () => ({
    meta: [
      { title: "Almanac — Daily Readings & Liturgical Colours" },
      { name: "description", content: "The church almanac: each day's theme, liturgical colour, memorial and the morning and evening Bible readings." },
      { property: "og:title", content: "Almanac — Daily Readings & Liturgical Colours" },
      { property: "og:description", content: "Daily theme, liturgical colour and morning and evening readings." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://churchcompanion.lovable.app/almanac" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://churchcompanion.lovable.app/almanac" }],
  }),
  component: AlmanacPage,
});

// ================= Types =================
interface AlmanacRow {
  date: string;
  day_name: string;
  theme: string;
  colour: "W" | "G" | "V" | "R";
  morning_readings: string[];
  evening_readings: string[];
  is_sunday: boolean;
  memorial: string | null;
  ls_ot: string[];
  ls_psalm: string[];
  ls_second: string[];
  ls_gospel: string[];
}

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const COLOUR_META: Record<AlmanacRow["colour"], { name: string; bg: string; fg: string; ring: string }> = {
  W: { name: "White", bg: "#F5F0E8", fg: "#2C1A0E", ring: "rgba(0,0,0,0.15)" },
  G: { name: "Green", bg: "#2D6A4F", fg: "#FFFFFF", ring: "rgba(45,106,79,0.35)" },
  V: { name: "Violet", bg: "#6B3080", fg: "#FFFFFF", ring: "rgba(107,48,128,0.35)" },
  R: { name: "Red", bg: "#C62828", fg: "#FFFFFF", ring: "rgba(198,40,40,0.35)" },
};

// ================= Bookmarks =================
const BM_KEY = "cc.almanac.bookmarks";
function readBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(BM_KEY) || "[]")); } catch { return new Set(); }
}
function writeBookmarks(s: Set<string>) {
  try { localStorage.setItem(BM_KEY, JSON.stringify([...s])); } catch {}
}

// ================= Reading parser =================
function parseReading(raw: string): { testament: "OT" | "NT" | null; body: string } {
  const m = raw.trim().match(/^(OT|NT)\b[\s:.-]*(.*)$/i);
  if (m) return { testament: m[1].toUpperCase() as "OT" | "NT", body: m[2].trim() };
  return { testament: null, body: raw.trim() };
}

// ================= Root page (view state) =================
type View =
  | { kind: "years" }
  | { kind: "year"; year: number }
  | { kind: "month"; year: number; month: number }
  | { kind: "day"; year: number; month: number; date: string };

function AlmanacPage() {
  const [view, setView] = useState<View>({ kind: "years" });

  const back = () => {
    if (view.kind === "day") setView({ kind: "month", year: view.year, month: view.month });
    else if (view.kind === "month") setView({ kind: "year", year: view.year });
    else if (view.kind === "year") setView({ kind: "years" });
  };

  const title =
    view.kind === "years" ? "Almanac"
    : view.kind === "year" ? `Almanac ${view.year}`
    : view.kind === "month" ? `${MONTHS_FULL[view.month]} ${view.year}`
    : "Day";

  const left =
    view.kind === "years" ? (
      <Link to="/" className="-ml-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">‹ Home</Link>
    ) : (
      <button onClick={back} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
    );

  return (
    <AppShell title={title} left={left}>
      <div className="pt-3 pb-8 animate-fade-in">
        {/* Breadcrumb */}
        <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
          <span className="text-muted-foreground/50">/</span>
          <button
            onClick={() => setView({ kind: "years" })}
            className={cn(view.kind === "years" ? "font-semibold" : "text-muted-foreground hover:text-foreground")}
          >
            Almanac
          </button>
          {view.kind !== "years" && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <button
                onClick={() => setView({ kind: "year", year: (view as any).year })}
                className={cn(view.kind === "year" ? "font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                {(view as any).year}
              </button>
            </>
          )}
          {(view.kind === "month" || view.kind === "day") && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <button
                onClick={() => setView({ kind: "month", year: view.year, month: view.month })}
                className={cn(view.kind === "month" ? "font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                {MONTHS_FULL[view.month]}
              </button>
            </>
          )}
          {view.kind === "day" && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-semibold">{view.date.slice(-2)}</span>
            </>
          )}
        </nav>

        {view.kind === "years" && (
          <YearsView onPick={(year) => setView({ kind: "year", year })} />
        )}
        {view.kind === "year" && (
          <YearView
            year={view.year}
            onOpenMonth={(month) => setView({ kind: "month", year: view.year, month })}
          />
        )}
        {view.kind === "month" && (
          <MonthView
            year={view.year}
            month={view.month}
            onOpenDay={(date) => setView({ kind: "day", year: view.year, month: view.month, date })}
          />
        )}
        {view.kind === "day" && (
          <DayView
            date={view.date}
            year={view.year}
            month={view.month}
            onDeleted={() => setView({ kind: "month", year: view.year, month: view.month })}
          />
        )}

      </div>
    </AppShell>
  );
}

// ================= Years View =================
function YearsView({ onPick }: { onPick: (year: number) => void }) {
  const currentYear = new Date().getFullYear();

  const q = useQuery({
    queryKey: ["almanac", "years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("almanac_entries")
        .select("date")
        .order("date", { ascending: false });
      if (error) throw error;
      const years = new Set<number>();
      for (const r of (data ?? []) as { date: string }[]) {
        years.add(new Date(r.date + "T00:00:00").getFullYear());
      }
      years.add(currentYear); // always include current year
      return [...years].sort((a, b) => b - a);
    },
  });

  if (q.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;

  const years = q.data ?? [currentYear];

  return (
    <>
      <div
        className="relative mb-4 overflow-hidden rounded-[24px] px-4 py-4 text-white elev-1"
        style={{ background: "linear-gradient(135deg, var(--lit-purple), #4A2560)" }}
      >
        <StainedGlass variant="corner" />
        <div className="relative flex items-center gap-3">
          <CalendarDays className="h-5 w-5 shrink-0 opacity-90" />
          <p className="min-w-0 flex-1 font-display text-base font-semibold leading-none">Select a Year</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {years.map((y) => {
          const isCurrent = y === currentYear;
          return (
            <button
              key={y}
              onClick={() => onPick(y)}
              className={cn(
                "tap-card group relative flex items-center gap-2.5 rounded-2xl border px-4 py-4 text-left transition-all",
                "border-white/40 bg-white/60 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-0.5",
                "dark:bg-white/5 dark:border-white/10",
                isCurrent && "ring-2 ring-primary/60",
              )}
            >
              <FolderOpen className="h-5 w-5 shrink-0 brand-text" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold tabular-nums leading-none">{y}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Almanac</p>
              </div>
              {isCurrent && (
                <span className="absolute -right-1 -top-1 rounded-full gold-bg px-1.5 py-0.5 text-[9px] font-bold uppercase elev-1">
                  Now
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ================= Year → Month Folders =================
function YearView({ year, onOpenMonth }: { year: number; onOpenMonth: (m: number) => void }) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Light query: just dates present in this year (used to show counts / enable states)
  const q = useQuery({
    queryKey: ["almanac", "year-months", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("almanac_entries")
        .select("date")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
      if (error) throw error;
      const byMonth: Record<number, number> = {};
      for (const r of (data ?? []) as { date: string }[]) {
        const m = new Date(r.date + "T00:00:00").getMonth();
        byMonth[m] = (byMonth[m] ?? 0) + 1;
      }
      return byMonth;
    },
  });

  const counts = q.data ?? {};

  return (
    <>
      <div
        className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-white shadow-md"
        style={{ background: "linear-gradient(135deg, #6D5EF7, #4A38C9)" }}
      >
        <FolderOpen className="h-5 w-5 shrink-0 opacity-90" />
        <p className="min-w-0 flex-1 text-base font-semibold leading-none">{year}</p>
        <p className="text-[11px] uppercase tracking-wider opacity-90">12 Months</p>
      </div>

      {q.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {MONTHS_FULL.map((name, i) => {
            const count = counts[i] ?? 0;
            const isCurrent = year === currentYear && i === currentMonth;
            const disabled = false;
            return (
              <button
                key={name}
                onClick={() => onOpenMonth(i)}
                className={cn(
                  "tap-card group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-all",
                  "border-white/40 bg-white/60 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 dark:bg-white/5 dark:border-white/10",
                  isCurrent && "ring-2 ring-primary/60",
                )}
              >
                <Folder className={cn("h-5 w-5", "brand-text")} />
                <span className="text-sm font-semibold leading-none">{name.slice(0, 3)}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {count > 0 ? `${count} days` : "—"}
                </span>
                {isCurrent && (
                  <span className="absolute -right-1 -top-1 rounded-full brand-bg px-1.5 py-0.5 text-[9px] font-bold uppercase shadow">
                    Now
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ================= Month → Calendar =================
function MonthView({
  year,
  month,
  onOpenDay,
}: {
  year: number;
  month: number;
  onOpenDay: (date: string) => void;
}) {
  const q = useQuery({
    queryKey: ["almanac", "month", year, month],
    queryFn: async () => {
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("almanac_entries")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date");
      if (error) throw error;
      return (data ?? []) as AlmanacRow[];
    },
    staleTime: 5 * 60 * 1000, // cache recently opened months
  });

  const rows = q.data ?? [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const byDay = useMemo(() => {
    const out: Record<number, AlmanacRow> = {};
    for (const r of rows) out[new Date(r.date + "T00:00:00").getDate()] = r;
    return out;
  }, [rows]);

  const today = new Date();
  const todayNum =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  const [bmVersion] = useState(0);
  const bookmarks = useMemo(() => readBookmarks(), [bmVersion]);

  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="animate-fade-in">
      <MonthFolderCard year={year} month={month} />

      {q.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Weekday labels */}
          <div className="mb-2 grid grid-cols-7 gap-1.5 px-0.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {w}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (d == null) return <div key={`b-${i}`} className="aspect-square" />;
              const row = byDay[d];
              const dateStr = row?.date;
              const isToday = d === todayNum;
              const isBookmarked = !!dateStr && bookmarks.has(dateStr);
              return (
                <button
                  key={d}
                  disabled={!row}
                  onClick={() => row && onOpenDay(row.date)}
                  className={cn(
                    "tap-card relative aspect-square rounded-xl text-sm font-semibold transition-all",
                    "flex flex-col items-center justify-center gap-1",
                    row
                      ? "border border-white/40 bg-white/60 backdrop-blur-xl hover:-translate-y-0.5 hover:shadow-sm dark:bg-white/5 dark:border-white/10"
                      : "border border-dashed border-muted-foreground/20 bg-transparent text-muted-foreground/40",
                    isToday && "ring-2 ring-primary/70 bg-primary/10",
                  )}
                >
                  <span className="tabular-nums">{d}</span>
                  {row && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isBookmarked ? "bg-[var(--brand)]" : "bg-primary/40",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/40 bg-white/50 px-3.5 py-2.5 text-[11px] backdrop-blur-xl dark:bg-white/5 dark:border-white/10">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-[5px] bg-primary/20 ring-2 ring-primary/70" />
              Today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/70" />
              Has entry
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
              Bookmarked
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No entries yet for this month. Ask an admin to import the almanac.
            </p>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">Tap a date to open its almanac.</p>
          )}
        </>
      )}
    </div>
  );
}

function MonthFolderCard({ year, month }: { year: number; month: number }) {
  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-white shadow-md"
      style={{ background: "linear-gradient(135deg, #6D5EF7, #4A38C9)" }}
    >
      <FolderOpen className="h-5 w-5 shrink-0 opacity-90" />
      <p className="min-w-0 flex-1 text-base font-semibold leading-none">
        {MONTHS_FULL[month]} {year}
      </p>
    </div>
  );
}

// ================= Day View (full screen) =================
function DayView({ date, year, month, onDeleted }: { date: string; year: number; month: number; onDeleted: () => void }) {
  const q = useQuery({
    queryKey: ["almanac", "day", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("almanac_entries")
        .select("*")
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      return data as AlmanacRow | null;
    },
  });

  if (q.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!q.data) return <EmptyState title="No entry" hint="This date has no almanac entry." />;

  return <DayDetail row={q.data} monthCtx={{ year, month }} onDeleted={onDeleted} />;
}

// ------------ admin detection (no redirect) ------------
function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (cancelled) return;
      const rs = (roles ?? []).map((r) => r.role);
      setIsAdmin(rs.includes("admin") || rs.includes("super_admin"));
    })();
    return () => { cancelled = true; };
  }, []);
  return isAdmin;
}

function DayDetail({ row, monthCtx, onDeleted }: { row: AlmanacRow; monthCtx: { year: number; month: number }; onDeleted: () => void }) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);

  const [bm, setBm] = useState<Set<string>>(() => readBookmarks());
  useEffect(() => { setBm(readBookmarks()); }, [row.date]);

  const isBookmarked = bm.has(row.date);
  const toggleBookmark = () => {
    const next = new Set(bm);
    if (next.has(row.date)) next.delete(row.date); else next.add(row.date);
    writeBookmarks(next);
    setBm(next);
  };

  const d = new Date(row.date + "T00:00:00");
  const dayNum = String(d.getDate()).padStart(2, "0");
  const monthName = MONTHS_FULL[d.getMonth()];
  const dayName = row.day_name || WEEKDAYS_FULL[d.getDay()];
  const colour = COLOUR_META[row.colour];

  const hasLordsSupper =
    (row.ls_ot?.length ?? 0) > 0 ||
    (row.ls_psalm?.length ?? 0) > 0 ||
    (row.ls_second?.length ?? 0) > 0 ||
    (row.ls_gospel?.length ?? 0) > 0;

  // Special day = Sunday OR anything that has a Lord's Supper set defined.
  const isSpecialDay = row.is_sunday || hasLordsSupper;

  // Fallback: on Sunday when structured LS fields empty, older data may store LS in evening_readings.
  const legacyLordsSupper =
    !hasLordsSupper && row.is_sunday && (row.evening_readings?.length ?? 0) > 0;

  const onDelete = async () => {
    if (!confirm(`Delete almanac entry for ${row.date}? This cannot be undone.`)) return;
    const { error } = await supabase.from("almanac_entries").delete().eq("date", row.date);
    if (error) { alert(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["almanac"] });
    onDeleted();
  };

  if (editing) {
    return (
      <EditDay
        row={row}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await qc.invalidateQueries({ queryKey: ["almanac"] });
        }}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {MONTHS_FULL[monthCtx.month]} {monthCtx.year}
      </p>

      <Card className="overflow-hidden rounded-2xl border-white/40 bg-white/60 p-0 backdrop-blur-xl dark:bg-white/5 dark:border-white/10">
        <div className="flex items-start gap-3 border-b border-white/30 p-5 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{dayName}</p>
            <h2 className="mt-0.5 text-3xl font-bold leading-tight tracking-tight">
              {dayNum} {monthName} {d.getFullYear()}
            </h2>
          </div>
          <button
            onClick={toggleBookmark}
            aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/40 bg-white/50 backdrop-blur hover:bg-accent dark:bg-white/5 dark:border-white/10"
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-4 w-4 brand-text" />
            ) : (
              <Bookmark className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        <div className="space-y-3 p-5">
          <MetaRow label="Day" value={dayName} />
          <MetaRow label="Theme" value={row.theme || "—"} />
          {row.memorial && <MetaRow label="Memorial" value={row.memorial} />}
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Colour
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: colour.bg, color: colour.fg, boxShadow: `inset 0 0 0 1px ${colour.ring}` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: colour.fg, opacity: 0.85 }} />
              {colour.name}
            </span>
          </div>

          {isSpecialDay ? (
            <CombinedWorshipCard
              morning={row.morning_readings ?? []}
              evening={row.evening_readings ?? []}
            />
          ) : (
            <>
              <WorshipCard title="Morning Worship" hint="सुबह" readings={row.morning_readings ?? []} />
              <WorshipCard title="Evening Worship" hint="शाम" readings={row.evening_readings ?? []} />
            </>
          )}

          {hasLordsSupper && (
            <div className="rounded-2xl border border-white/40 bg-white/60 p-4 backdrop-blur dark:bg-white/5 dark:border-white/10">
              <p className="mb-3 text-sm font-semibold">Lord's Supper</p>
              <div className="space-y-3">
                <NamedReading label="Old Testament" readings={row.ls_ot} />
                <NamedReading label="Psalm" readings={row.ls_psalm} />
                <NamedReading label="Second Reading" readings={row.ls_second} />
                <NamedReading label="Gospel" readings={row.ls_gospel} />
              </div>
            </div>
          )}
          {legacyLordsSupper && (
            <WorshipCard title="Lord's Supper" readings={row.evening_readings ?? []} />
          )}

          {isAdmin && (
            <div className="mt-2 flex gap-2 pt-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm font-semibold backdrop-blur hover:bg-accent dark:bg-white/5 dark:border-white/10"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
              <button
                onClick={onDelete}
                className="tap-card focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive backdrop-blur transition-colors duration-200 hover:bg-destructive/20"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function CombinedWorshipCard({ morning, evening }: { morning: string[]; evening: string[] }) {
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const r of [...morning, ...evening]) {
    const k = r.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    combined.push(k);
  }
  if (combined.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/40 bg-white/60 p-4 backdrop-blur dark:bg-white/5 dark:border-white/10">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold">Morning / Evening Worship</p>
        <p className="font-hi text-xs text-muted-foreground">सुबह / शाम</p>
      </div>
      <ol className="space-y-2">
        {combined.map((raw, i) => {
          const { testament, body } = parseReading(raw);
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full brand-bg text-[10px] font-bold tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                {testament && (
                  <span className="mr-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-primary">
                    {testament}
                  </span>
                )}
                <span className="font-medium">{body}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium leading-snug">{value}</span>
    </div>
  );
}

function WorshipCard({ title, hint, readings }: { title: string; hint?: string; readings: string[] }) {
  if (!readings || readings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/40 bg-white/60 p-4 backdrop-blur dark:bg-white/5 dark:border-white/10">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="font-hi text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ol className="space-y-2">
        {readings.map((raw, i) => {
          const { testament, body } = parseReading(raw);
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full brand-bg text-[10px] font-bold tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                {testament && (
                  <span className="mr-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-primary">
                    {testament}
                  </span>
                )}
                <span className="font-medium">{body}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NamedReading({ label, readings }: { label: string; readings: string[] }) {
  if (!readings || readings.length === 0) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {readings.map((r, i) => (
          <p key={i} className="text-sm font-medium leading-snug">{r}</p>
        ))}
      </div>
    </div>
  );
}

// ================= Edit Day (admin) =================
function EditDay({ row, onCancel, onSaved }: { row: AlmanacRow; onCancel: () => void; onSaved: () => void }) {
  const toText = (arr?: string[] | null) => (arr ?? []).join("\n");
  const fromText = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const [theme, setTheme] = useState(row.theme ?? "");
  const [memorial, setMemorial] = useState(row.memorial ?? "");
  const [colour, setColour] = useState<AlmanacRow["colour"]>(row.colour ?? "G");
  const [isSunday, setIsSunday] = useState(!!row.is_sunday);
  const [morning, setMorning] = useState(toText(row.morning_readings));
  const [evening, setEvening] = useState(toText(row.evening_readings));
  const [lsOt, setLsOt] = useState(toText(row.ls_ot));
  const [lsPs, setLsPs] = useState(toText(row.ls_psalm));
  const [lsSecond, setLsSecond] = useState(toText(row.ls_second));
  const [lsGospel, setLsGospel] = useState(toText(row.ls_gospel));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setErr(null);
    const { error } = await supabase
      .from("almanac_entries")
      .update({
        theme: theme.trim() || "No theme",
        memorial: memorial.trim() || null,
        colour,
        is_sunday: isSunday,
        morning_readings: fromText(morning),
        evening_readings: fromText(evening),
        ls_ot: fromText(lsOt),
        ls_psalm: fromText(lsPs),
        ls_second: fromText(lsSecond),
        ls_gospel: fromText(lsGospel),
      })
      .eq("date", row.date);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  const inputCls = "w-full rounded-xl border border-white/40 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/5 dark:border-white/10";
  const areaCls = inputCls + " min-h-[80px] font-mono text-xs leading-relaxed";

  return (
    <Card className="overflow-hidden rounded-2xl border-white/40 bg-white/60 p-5 backdrop-blur-xl dark:bg-white/5 dark:border-white/10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Editing</p>
          <h2 className="text-lg font-bold">{row.date}</h2>
        </div>
        <button
          onClick={onCancel}
          data-icon-button
          className="hit-target grid h-9 w-9 place-items-center rounded-xl border border-white/40 bg-white/50 backdrop-blur transition-colors duration-200 hover:bg-accent dark:bg-white/5 dark:border-white/10"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme
          <input className={"mt-1 " + inputCls} value={theme} onChange={(e) => setTheme(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Memorial
          <input className={"mt-1 " + inputCls} value={memorial} onChange={(e) => setMemorial(e.target.value)} placeholder="Optional" />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colour</span>
          {(["W","G","V","R"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setColour(c)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold",
                colour === c ? "ring-2 ring-primary" : "opacity-70",
              )}
              style={{ background: COLOUR_META[c].bg, color: COLOUR_META[c].fg }}
            >{COLOUR_META[c].name}</button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isSunday} onChange={(e) => setIsSunday(e.target.checked)} />
          Mark as Sunday / special day
        </label>

        <p className="pt-2 text-[11px] text-muted-foreground">One reading per line. Prefix with <code>OT:</code> or <code>NT:</code> when relevant.</p>

        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Morning Worship
          <textarea className={"mt-1 " + areaCls} value={morning} onChange={(e) => setMorning(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evening Worship
          <textarea className={"mt-1 " + areaCls} value={evening} onChange={(e) => setEvening(e.target.value)} />
        </label>

        <p className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lord's Supper</p>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Old Testament
          <textarea className={"mt-1 " + areaCls} value={lsOt} onChange={(e) => setLsOt(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Psalm
          <textarea className={"mt-1 " + areaCls} value={lsPs} onChange={(e) => setLsPs(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Second Reading
          <textarea className={"mt-1 " + areaCls} value={lsSecond} onChange={(e) => setLsSecond(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gospel
          <textarea className={"mt-1 " + areaCls} value={lsGospel} onChange={(e) => setLsGospel(e.target.value)} />
        </label>

        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl brand-bg px-3 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-white/60 px-3 py-2.5 text-sm font-semibold backdrop-blur hover:bg-accent dark:bg-white/5 dark:border-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </Card>
  );
}

