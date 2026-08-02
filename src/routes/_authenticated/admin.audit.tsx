import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import { useAdminGuard } from "../../lib/use-admin-guard";
import { firstNameFrom } from "@/lib/admin-name";
import { Music, BookOpen, ListMusic, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
  head: () => ({
    meta: [
      { title: "Change history · Church Companion Admin" },
      { name: "description", content: "Admin-only log of who changed songs, books and Today's Songs, and when." },
      { property: "og:title", content: "Change history · Church Companion Admin" },
      { property: "og:description", content: "Admin-only log of content changes across songs, books and Today's Songs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TABLES = ["songs", "books", "today_song_sets", "today_song_items"] as const;
type TableName = (typeof TABLES)[number];

interface LogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target: string | null;
  payload: any;
  created_at: string;
}

const FILTERS: { key: "all" | TableName; label: string }[] = [
  { key: "all", label: "All" },
  { key: "songs", label: "Songs" },
  { key: "books", label: "Books" },
  { key: "today_song_sets", label: "Today sets" },
  { key: "today_song_items", label: "Today items" },
];

function iconFor(table: string) {
  if (table === "songs") return <Music className="h-4 w-4" />;
  if (table === "books") return <BookOpen className="h-4 w-4" />;
  return <ListMusic className="h-4 w-4" />;
}

function opStyle(op: string) {
  if (op === "INSERT") return "brand-bg";
  if (op === "DELETE") return "bg-destructive text-destructive-foreground";
  return "bg-secondary";
}

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function AuditPage() {
  const { checked } = useAdminGuard();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [actors, setActors] = useState<Map<string, { display_name: string | null; email: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | TableName>("all");

  useEffect(() => {
    if (!checked) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, actor_id, action, target, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      if (error) toast.error(error.message);
      const list = ((data ?? []) as LogRow[]).filter((r) =>
        TABLES.some((t) => (r.target ?? "").startsWith(`${t}:`) || r.action.endsWith(t)),
      );
      const ids = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, email").in("id", ids);
        if (!cancelled) setActors(new Map((profs ?? []).map((p: any) => [p.id, p])));
      }
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [checked]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => (r.payload?.table ?? "") === filter)),
    [rows, filter],
  );

  if (!checked) return null;

  return (
    <AppShell
      title="Change history"
      left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>}
      hideNav
    >
      <div className="pt-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`focus-ring shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold min-h-9 ${
                filter === f.key ? "brand-bg" : "glass-chip"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <Card className="p-6 text-center">
            <History className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No changes recorded yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {visible.map((r) => {
              const table = (r.payload?.table as string) ?? (r.target ?? "").split(":")[0];
              const op = (r.payload?.op as string) ?? r.action.split(" ")[0]?.toUpperCase();
              const prof = r.actor_id ? actors.get(r.actor_id) : null;
              const who =
                firstNameFrom({ displayName: prof?.display_name, email: prof?.email }) ||
                (r.actor_id ? r.actor_id.slice(0, 8) : "System");
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">{iconFor(table)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${opStyle(op)}`}>
                          {op === "INSERT" ? "added" : op === "DELETE" ? "deleted" : "updated"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{table.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-1 font-medium truncate">
                        {r.payload?.label || r.target || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        by {who} · {fmt(r.created_at)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
