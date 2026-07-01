import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card, EmptyState } from "../components/ui-bits";

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

const badgeStyle: Record<AlmanacRow["colour"], React.CSSProperties> = {
  W: { background: "#F5F0E8", border: "1px solid #ccc", color: "#2C1A0E" },
  G: { background: "#2D6A4F", color: "#FFFFFF" },
  V: { background: "#6B3080", color: "#FFFFFF" },
  R: { background: "#C62828", color: "#FFFFFF" },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function AlmanacPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);

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

  const selectedDay = useMemo(
    () => (day ? (q.data ?? []).find((r) => r.date === day) ?? null : null),
    [day, q.data],
  );

  const back = () => {
    if (day) return setDay(null);
    if (month != null) return setMonth(null);
  };

  return (
    <AppShell
      title={day ? "Reading" : month != null ? `${MONTHS[month]} ${year}` : `Almanac · ${year}`}
      left={
        month != null || day ? (
          <button onClick={back} className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <Link to="/" className="-ml-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">‹ Home</Link>
        )
      }
    >
      <div className="pt-4">
        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : selectedDay ? (
          <DayView row={selectedDay} />
        ) : month != null ? (
          <MonthGrid rows={byMonth[month] ?? []} year={year} month={month} onPick={setDay} />
        ) : (
          <YearView byMonth={byMonth} year={year} onYear={setYear} onPick={setMonth} />
        )}
      </div>
    </AppShell>
  );
}

function YearView({
  byMonth,
  year,
  onYear,
  onPick,
}: {
  byMonth: Record<number, AlmanacRow[]>;
  year: number;
  onYear: (y: number) => void;
  onPick: (m: number) => void;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-center gap-3">
        <button onClick={() => onYear(year - 1)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent">‹</button>
        <span className="text-lg font-semibold">{year}</span>
        <button onClick={() => onYear(year + 1)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent">›</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MONTHS.map((m, i) => {
          const count = (byMonth[i] ?? []).length;
          return (
            <button
              key={m}
              onClick={() => onPick(i)}
              className="tap-card rounded-2xl border bg-card p-4 text-left hover:bg-accent"
            >
              <p className="text-sm font-semibold">{m}</p>
              <p className="text-[11px] text-muted-foreground">{count} entries</p>
            </button>
          );
        })}
      </div>
    </>
  );
}

function MonthGrid({
  rows,
  year,
  month,
  onPick,
}: {
  rows: AlmanacRow[];
  year: number;
  month: number;
  onPick: (d: string) => void;
}) {
  if (rows.length === 0) return <EmptyState title="No entries" hint="Ask an admin to import the almanac." />;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDay: Record<number, AlmanacRow> = {};
  for (const r of rows) byDay[new Date(r.date + "T00:00:00").getDate()] = r;
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
        const r = byDay[d];
        return (
          <button
            key={d}
            disabled={!r}
            onClick={() => r && onPick(r.date)}
            className="tap-card aspect-square rounded-xl border bg-card p-1.5 text-left disabled:opacity-40"
          >
            <span className="text-xs font-semibold">{d}</span>
            {r && (
              <span
                className="mt-1 block h-1.5 w-4 rounded-full"
                style={{ background: (badgeStyle[r.colour] as any).background }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function DayView({ row }: { row: AlmanacRow }) {
  const date = new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const readings = row.is_sunday
    ? [...row.morning_readings, ...row.evening_readings]
    : null;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{date}</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{row.theme || row.day_name}</h2>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={badgeStyle[row.colour]}
        >
          {row.colour}
        </span>
      </div>

      <div className="mt-4">
        {row.is_sunday && readings ? (
          <ol className="space-y-2 text-sm">
            {readings.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">{i + 1})</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid grid-cols-2 divide-x">
            <div className="pr-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Morning / सुबह
              </p>
              <ul className="space-y-1 text-sm">
                {(row.morning_readings ?? []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="pl-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Evening / शाम
              </p>
              <ul className="space-y-1 text-sm">
                {(row.evening_readings ?? []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
