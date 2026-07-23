import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import { Pencil, Trash2, Save, X, Search } from "lucide-react";
import type { Book, Song, BookSection } from "../../lib/types";
import { useAdminGuard } from "../../lib/use-admin-guard";

export const Route = createFileRoute("/_authenticated/admin/manage")({
  component: ManagePage,
});

type Tab = "songs" | "sections";

function ManagePage() {
  const { checked } = useAdminGuard();
  const [tab, setTab] = useState<Tab>("songs");
  if (!checked) return null;
  return (
    <AppShell title="Manage content" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1 text-sm font-medium">
          <button onClick={() => setTab("songs")} className={`rounded-lg py-2 ${tab === "songs" ? "bg-card shadow" : ""}`}>Songs</button>
          <button onClick={() => setTab("sections")} className={`rounded-lg py-2 ${tab === "sections" ? "bg-card shadow" : ""}`}>Book sections</button>
        </div>
        {tab === "songs" ? <SongsManager /> : <SectionsManager />}
      </div>
    </AppShell>
  );
}

function SongsManager() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("songs").select("*").order("number", { nullsFirst: false }).limit(1000);
    if (error) toast.error(error.message);
    setSongs((data ?? []) as Song[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return songs;
    const n = q.toLowerCase();
    return songs.filter((s) =>
      String(s.number ?? "").includes(n) ||
      s.title_hi.toLowerCase().includes(n) ||
      (s.title_en ?? "").toLowerCase().includes(n),
    );
  }, [songs, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const del = async (id: string) => {
    if (!confirm("Delete this song?")) return;
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setSongs((p) => p.filter((s) => s.id !== id));
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} song${ids.length > 1 ? "s" : ""}?`)) return;
    const { error } = await supabase.from("songs").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted ${ids.length}`);
    setSongs((p) => p.filter((s) => !selected.has(s.id)));
    exitSelect();
  };

  const save = async (s: Song) => {
    const { error } = await supabase.from("songs").update({
      number: s.number,
      title_hi: s.title_hi,
      title_en: s.title_en,
      lyrics_hi: s.lyrics_hi,
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number or title…" className="w-full rounded-xl border bg-secondary pl-9 pr-3 py-2 text-sm" />
      </div>

      <div className="flex items-center justify-between gap-2">
        {selectMode ? (
          <>
            <button onClick={toggleAll} className="text-xs font-medium px-3 py-1.5 rounded-lg border">
              {selected.size === filtered.length && filtered.length > 0 ? "Unselect all" : "Select all"}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button onClick={bulkDelete} disabled={selected.size === 0} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground disabled:opacity-40 inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              <button onClick={exitSelect} className="text-xs font-medium px-3 py-1.5 rounded-lg border">Cancel</button>
            </div>
          </>
        ) : (
          <button onClick={() => setSelectMode(true)} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border">Select</button>
        )}
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id}>
              {editing?.id === s.id ? (
                <EditSong song={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSave={() => save(editing)} />
              ) : (
                <Card className={`p-3 flex items-center gap-2 ${selectMode && selected.has(s.id) ? "ring-2 ring-primary" : ""}`}>
                  {selectMode && (
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-primary" />
                  )}
                  <span className="w-10 text-xs text-muted-foreground tabular-nums">{s.number ?? "—"}</span>
                  <div className="flex-1 min-w-0" onClick={() => selectMode && toggle(s.id)}>
                    <p className="text-sm font-medium truncate font-hi">{s.title_hi}</p>
                    {s.title_en && <p className="text-[11px] text-muted-foreground truncate">{s.title_en}</p>}
                  </div>
                  {!selectMode && (
                    <>
                      <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-accent" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => del(s.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </Card>
              )}
            </li>
          ))}
          {filtered.length === 0 && <li className="text-xs text-muted-foreground py-4 text-center">No songs.</li>}
        </ul>
      )}
    </div>
  );
}

function EditSong({ song, onChange, onCancel, onSave }: { song: Song; onChange: (s: Song) => void; onCancel: () => void; onSave: () => void }) {
  return (
    <Card className="p-3 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <input value={song.number ?? ""} onChange={(e) => onChange({ ...song, number: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="#" className="rounded-lg border bg-secondary px-2 py-1.5 text-sm" />
        <input value={song.title_hi} onChange={(e) => onChange({ ...song, title_hi: e.target.value })} placeholder="Title (Hindi)" className="col-span-3 rounded-lg border bg-secondary px-2 py-1.5 text-sm font-hi" />
      </div>
      <input value={song.title_en ?? ""} onChange={(e) => onChange({ ...song, title_en: e.target.value })} placeholder="Title (English)" className="w-full rounded-lg border bg-secondary px-2 py-1.5 text-sm" />
      <textarea value={song.lyrics_hi} onChange={(e) => onChange({ ...song, lyrics_hi: e.target.value })} rows={8} className="w-full rounded-lg border bg-secondary px-2 py-1.5 text-sm font-hi" />
      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg brand-bg py-2 text-sm font-medium"><Save className="h-4 w-4" /> Save</button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><X className="h-4 w-4" /> Cancel</button>
      </div>
    </Card>
  );
}

function SectionsManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>("");
  const [sections, setSections] = useState<BookSection[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<BookSection | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("books").select("*").order("sort_order");
      const list = (data ?? []) as Book[];
      setBooks(list);
      const first = list.find((b) => b.slug !== "song-book") ?? list[0];
      if (first) setBookId(first.id);
    })();
  }, []);

  const load = async () => {
    if (!bookId) return;
    setLoading(true);
    const { data, error } = await supabase.from("book_sections").select("*").eq("book_id", bookId).order("sort_order").order("number", { nullsFirst: false });
    if (error) toast.error(error.message);
    setSections((data ?? []) as BookSection[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookId]);

  const filtered = useMemo(() => {
    if (!q) return sections;
    const n = q.toLowerCase();
    return sections.filter((s) =>
      String(s.number ?? "").includes(n) ||
      (s.title_hi ?? "").toLowerCase().includes(n) ||
      (s.title_en ?? "").toLowerCase().includes(n),
    );
  }, [sections, q]);

  const del = async (id: string) => {
    if (!confirm("Delete this section?")) return;
    const { error } = await supabase.from("book_sections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setSections((p) => p.filter((s) => s.id !== id));
  };

  const save = async (s: BookSection) => {
    const { error } = await supabase.from("book_sections").update({
      number: s.number,
      title_hi: s.title_hi,
      title_en: s.title_en,
      body_hi: s.body_hi,
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-3">
      <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="w-full rounded-xl border bg-secondary px-3 py-2 text-sm">
        {books.filter((b) => b.slug !== "song-book").map((b) => (
          <option key={b.id} value={b.id}>{b.title_en}</option>
        ))}
      </select>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-xl border bg-secondary pl-9 pr-3 py-2 text-sm" />
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id}>
              {editing?.id === s.id ? (
                <EditSection section={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSave={() => save(editing)} />
              ) : (
                <Card className="p-3 flex items-center gap-2">
                  <span className="w-10 text-xs text-muted-foreground tabular-nums">{s.number ?? "—"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate font-hi">{s.title_hi ?? s.title_en ?? "(untitled)"}</p>
                  </div>
                  <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-accent" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(s.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </Card>
              )}
            </li>
          ))}
          {filtered.length === 0 && <li className="text-xs text-muted-foreground py-4 text-center">No sections.</li>}
        </ul>
      )}
    </div>
  );
}

function EditSection({ section, onChange, onCancel, onSave }: { section: BookSection; onChange: (s: BookSection) => void; onCancel: () => void; onSave: () => void }) {
  return (
    <Card className="p-3 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <input value={section.number ?? ""} onChange={(e) => onChange({ ...section, number: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="#" className="rounded-lg border bg-secondary px-2 py-1.5 text-sm" />
        <input value={section.title_hi ?? ""} onChange={(e) => onChange({ ...section, title_hi: e.target.value })} placeholder="Title (Hindi)" className="col-span-3 rounded-lg border bg-secondary px-2 py-1.5 text-sm font-hi" />
      </div>
      <input value={section.title_en ?? ""} onChange={(e) => onChange({ ...section, title_en: e.target.value })} placeholder="Title (English)" className="w-full rounded-lg border bg-secondary px-2 py-1.5 text-sm" />
      <textarea value={section.body_hi ?? ""} onChange={(e) => onChange({ ...section, body_hi: e.target.value })} rows={10} className="w-full rounded-lg border bg-secondary px-2 py-1.5 text-sm font-hi" />
      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg brand-bg py-2 text-sm font-medium"><Save className="h-4 w-4" /> Save</button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><X className="h-4 w-4" /> Cancel</button>
      </div>
    </Card>
  );
}
