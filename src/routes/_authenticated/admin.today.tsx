import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import type { Song } from "../../lib/types";
import { Plus, X } from "lucide-react";
import { useAdminGuard } from "../../lib/use-admin-guard";

export const Route = createFileRoute("/_authenticated/admin/today")({
  component: TodayPicker,
});

function TodayPicker() {
  const { checked } = useAdminGuard();
  const today = new Date().toISOString().slice(0, 10);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");
  const [setId, setSetId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("songs").select("*").order("number", { nullsFirst: false }).limit(500);
      setSongs((s ?? []) as Song[]);

      const { data: sets } = await supabase.from("today_song_sets").select("id, title").eq("for_date", today).order("published_at", { ascending: false }).limit(1);
      const cur = sets?.[0];
      if (cur) {
        setSetId(cur.id); setTitle(cur.title ?? "");
        const { data: items } = await supabase.from("today_song_items").select("song_id, position").eq("set_id", cur.id).order("position");
        setSelectedIds((items ?? []).map((i) => i.song_id));
      }
    })();
  }, [today]);

  const filtered = useMemo(() => {
    if (!q) return songs;
    const n = q.toLowerCase();
    return songs.filter((s) =>
      String(s.number ?? "").includes(n) ||
      s.title_hi.toLowerCase().includes(n) ||
      (s.title_en ?? "").toLowerCase().includes(n),
    );
  }, [songs, q]);

  const selected = selectedIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as Song[];

  const add = (id: string) => { if (!selectedIds.includes(id)) setSelectedIds([...selectedIds, id]); };
  const remove = (id: string) => setSelectedIds(selectedIds.filter((x) => x !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = selectedIds.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[i], next[j]] = [next[j], next[i]];
    setSelectedIds(next);
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let curId = setId;
      if (!curId) {
        const { data, error } = await supabase.from("today_song_sets").insert({ for_date: today, title: title || null, published_by: u.user!.id }).select("id").single();
        if (error) throw error;
        curId = data.id;
        setSetId(curId);
      } else {
        await supabase.from("today_song_sets").update({ title: title || null, published_at: new Date().toISOString() }).eq("id", curId);
        await supabase.from("today_song_items").delete().eq("set_id", curId);
      }
      if (selectedIds.length) {
        const rows = selectedIds.map((song_id, position) => ({ set_id: curId!, song_id, position }));
        const { error } = await supabase.from("today_song_items").insert(rows);
        if (error) throw error;
      }
      toast.success("Published — visible to all users");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AppShell title="Today's Songs" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-4 space-y-4">
        <Card className="p-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" placeholder="Sunday worship" />
          </label>
        </Card>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Selected ({selected.length})</p>
          {selected.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No songs yet — add from the list below.</p>
          ) : (
            <ul className="space-y-2">
              {selected.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border bg-card p-3">
                  <span className="text-xs font-bold w-5 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate font-hi">{s.title_hi}</p>
                    {s.number != null && <p className="text-[10px] text-muted-foreground">#{s.number}</p>}
                  </div>
                  <button onClick={() => move(s.id, -1)} className="text-xs px-2 py-1">↑</button>
                  <button onClick={() => move(s.id, 1)} className="text-xs px-2 py-1">↓</button>
                  <button onClick={() => remove(s.id)} className="text-muted-foreground p-1"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">All songs</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-full rounded-xl border bg-secondary px-3 py-2 text-sm" />
          <ul className="mt-2 max-h-72 overflow-auto rounded-xl border divide-y">
            {filtered.map((s) => (
              <li key={s.id}>
                <button onClick={() => add(s.id)} className="flex items-center gap-2 w-full p-3 text-left hover:bg-accent">
                  <Plus className="h-4 w-4 brand-text" />
                  <span className="w-9 text-xs text-muted-foreground tabular-nums">{s.number ?? "—"}</span>
                  <span className="text-sm font-medium truncate font-hi flex-1">{s.title_hi}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="p-3 text-xs text-muted-foreground">No songs found.</li>}
          </ul>
        </div>

        <button onClick={publish} disabled={publishing} className="w-full rounded-xl brand-bg py-3 text-sm font-semibold disabled:opacity-50 sticky bottom-4">
          {publishing ? "Publishing…" : "Publish for today"}
        </button>
      </div>
    </AppShell>
  );
}
