import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Folder, FolderOpen, Bookmark, BookmarkCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card, EmptyState } from "../components/ui-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/almanac")({
  head: () => ({ meta: [{ title: "Almanac — Church Companion" }] }),
  component: AlmanacPage,
});

interface AlmanacRow {
  date: string;
  day_name: string;
  theme: string;
  colour: "W" | "G" | "V" | "R";
  morning_readings: string[];
  evening_readings: string[];
  is_sunday: boolean;
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

// --- Bookmarks (per-date) ---
const BM_KEY = "cc.almanac.bookmarks";
function readBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(BM_KEY) || "[]")); } catch { return new Set(); }
}
function writeBookmarks(s: Set<string>) {
  try { localStorage.setItem(BM_KEY, JSON.stringify([...s])); } catch {}
}

// --- Reading parser: "OT Genesis / उत्पत्ति 1:1-10" ---
function parseReading(raw: string): { testament: "OT" | "NT" | null; body: string } {
  const m = raw.trim().match(/^(OT|NT)\b[\s:.-]*(.*)$/i);
  if (m) return { testament: m[1].toUpperCase() as "OT" | "NT", body: m[2].trim() };
  return { testament: null, body: raw.trim() };
}

function AlmanacPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["almanac", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("almanac_entries")
        .select("*")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`)
        .order("date");
      if (error) throw error;
      return (data ?? []) as AlmanacRow[];
    },
  });

  const byMonth = useMemo(() => {
    const out: Record<number, AlmanacRow[]> = {};
    for (const r of q.data ?? []) {
      const m = new Date(r.date + "T00:00:00").getMonth();
      (out[m] ||= []).push(r);
    }
    return out;
  }, [q.data]);

  const back = () => {
    if (openMonth != null) { setOpenMonth(null); setOpenDate(null); return; }
  };

  return (
    <AppShell
      title="Almanac"
      left={
        openMonth != null ? (
          <button onClick={back} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <Link to="/" className="-ml-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">‹ Home</Link>
        )
      }
    >
      <div className="pt-3 pb-8 animate-fade-in">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-1.5 text-xs">
          <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
          <span className="text-muted-foreground/50">/</span>
          <button
            onClick={() => { setOpenMonth(null); setOpenDate(null); }}
            className={cn(openMonth == null ? "font-semibold" : "text-muted-foreground hover:text-foreground")}
          >
            Almanac
          </button>
          {openMonth != null && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-semibold">{year}</span>
            </>
          )}
        </nav>

        {openMonth == null ? (
          <YearFolder
            year={year}
            onYear={setYear}
            byMonth={byMonth}
            loading={q.isLoading}
            onOpenMonth={(m) => { setOpenMonth(m); setOpenDate(null); }}
          />
        ) : (
          <MonthView
            year={year}
            month={openMonth}
            rows={byMonth[openMonth] ?? []}
            openDate={openDate}
            onToggleDate={(d) => setOpenDate((prev) => (prev === d ? null : d))}
          />
        )}
      </div>
    </AppShell>
  );
}


// ================= Year → Month Folders =================
function YearFolder({
  year,
  onYear,
  byMonth,
  loading,
  onOpenMonth,
}: {
  year: number;
  onYear: (y: number) => void;
  byMonth: Record<number, AlmanacRow[]>;
  loading: boolean;
  onOpenMonth: (m: number) => void;
}) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Year folder pill */}
      <div
        className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-white shadow-md"
        style={{ background: "linear-gradient(135deg, #6D5EF7, #4A38C9)" }}
      >
        <FolderOpen className="h-5 w-5 shrink-0 opacity-90" />
        <p className="min-w-0 flex-1 text-base font-semibold leading-none">{year}</p>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Previous year"
            onClick={() => onYear(year - 1)}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Next year"
            onClick={() => onYear(year + 1)}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/15"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {MONTHS_FULL.map((name, i) => {
            const count = (byMonth[i] ?? []).length;
            const isCurrent = year === currentYear && i === currentMonth;
            return (
              <button
                key={name}
                onClick={() => onOpenMonth(i)}
                className={cn(
                  "tap-card group relative flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-left transition-all",
                  "border-white/40 bg-white/60 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-0.5",
                  "dark:bg-white/5 dark:border-white/10",
                  isCurrent && "ring-2 ring-primary/60",
                )}
              >
                <Folder className="h-4 w-4 shrink-0 brand-text" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                {count > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
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


// ================= Month → Date Grid + Accordion =================
function MonthView({
  year,
  month,
  rows,
  openDate,
  onToggleDate,
}: {
  year: number;
  month: number;
  rows: AlmanacRow[];
  openDate: string | null;
  onToggleDate: (d: string) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const byDay = useMemo(() => {
    const out: Record<number, AlmanacRow> = {};
    for (const r of rows) out[new Date(r.date + "T00:00:00").getDate()] = r;
    return out;
  }, [rows]);

  const today = new Date();
  const todayNum =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  const openRow = openDate ? rows.find((r) => r.date === openDate) ?? null : null;

  const [bmVersion, setBmVersion] = useState(0);
  const bookmarks = useMemo(() => readBookmarks(), [bmVersion]);
  // Refresh bookmark markers whenever the open date changes (toggle inside DayDetail)
  useEffect(() => { setBmVersion((v) => v + 1); }, [openDate]);

  if (rows.length === 0) {
    return (
      <>
        <MonthFolderCard year={year} month={month} />
        <EmptyState title="No entries" hint="Ask an admin to import the almanac for this month." />
      </>
    );
  }

  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="animate-fade-in">
      {/* Month folder card */}
      <MonthFolderCard year={year} month={month} />

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
          const isOpen = !!dateStr && openDate === dateStr;
          const isToday = d === todayNum;
          const isBookmarked = !!dateStr && bookmarks.has(dateStr);
          return (
            <button
              key={d}
              disabled={!row}
              onClick={() => row && onToggleDate(row.date)}
              className={cn(
                "tap-card relative aspect-square rounded-xl text-sm font-semibold transition-all",
                "flex flex-col items-center justify-center gap-1",
                row
                  ? "border border-white/40 bg-white/60 backdrop-blur-xl hover:-translate-y-0.5 hover:shadow-sm dark:bg-white/5 dark:border-white/10"
                  : "border border-transparent bg-transparent text-muted-foreground/30",
                isOpen && "bg-primary text-primary-foreground border-primary shadow-md scale-[1.03]",
                isToday && !isOpen && "ring-1 ring-primary/60",
              )}
            >
              <span className="tabular-nums">{d}</span>
              {row && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isBookmarked ? "bg-yellow-400" : isOpen ? "bg-primary-foreground" : "bg-primary/70",
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
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full ring-1 ring-primary/60" />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[5px] bg-primary" />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          Bookmarked
        </span>
      </div>

      {/* Accordion detail or empty hint */}
      {openRow ? (
        <div className="mt-4 animate-fade-in">
          <DayDetail row={openRow} onBookmarkChange={() => setBmVersion((v) => v + 1)} />
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/40 bg-white/50 p-4 backdrop-blur-xl dark:bg-white/5 dark:border-white/10">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted/50">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground leading-snug">
            Tap on any date to view <br />the almanac details
          </p>
        </div>
      )}
    </div>
  );
}

// Purple folder card for the month header (matches year card style)
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

          {openRow && <DayDetail row={openRow} />}
        </div>
      </div>
    </div>
  );
}

// ================= Day Detail =================
function DayDetail({ row }: { row: AlmanacRow }) {
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

  const combined = row.is_sunday || (row.morning_readings?.length && !row.evening_readings?.length);
  const hasLordsSupper = row.is_sunday && (row.evening_readings?.length ?? 0) > 0;
  // Per spec: on Sunday, morning+evening merged into one worship, and L.S. separate if present.
  // We approximate: if is_sunday, treat morning_readings = "Morning / Evening Worship",
  // evening_readings = "Lord's Supper" (only when present).

  return (
    <Card className="mt-1 overflow-hidden rounded-2xl border-white/40 bg-white/60 p-0 backdrop-blur-xl dark:bg-white/5 dark:border-white/10 animate-fade-in">
      {/* Header */}
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

      {/* Meta rows */}
      <div className="space-y-3 p-5">
        <MetaRow label="Day" value={dayName} />
        <MetaRow label="Theme" value={row.theme || "No theme"} />
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

        {/* Worship sections */}
        {combined ? (
          <>
            <WorshipCard
              title={row.is_sunday ? "Morning / Evening Worship" : "Worship"}
              readings={row.morning_readings ?? []}
            />
            {hasLordsSupper && (
              <WorshipCard title="Lord's Supper" readings={row.evening_readings ?? []} />
            )}
          </>
        ) : (
          <>
            <WorshipCard title="Morning Worship" hint="सुबह" readings={row.morning_readings ?? []} />
            <WorshipCard title="Evening Worship" hint="शाम" readings={row.evening_readings ?? []} />
          </>
        )}
      </div>
    </Card>
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
