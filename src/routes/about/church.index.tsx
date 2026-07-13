import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card, EmptyState } from "../../components/ui-bits";
import { useT, pickLang } from "../../lib/i18n";
import { useIsAdmin } from "../../lib/use-admin";
import { uploadAboutMedia, signAboutMedia } from "../../lib/about-media";
import { Plus, Pencil, Eye, EyeOff, ArrowUp, ArrowDown, Trash2, ImagePlus, Save, X } from "lucide-react";

type Entry = {
  id: string;
  title_en: string; title_hi: string | null;
  body_en: string; body_hi: string | null;
  photo_urls: string[];
  display_order: number;
  is_published: boolean;
};

export const Route = createFileRoute("/about/church/")({
  head: () => ({
    meta: [
      { title: "About Church — Church Companion" },
      { name: "description", content: "About our congregation and parish life." },
    ],
  }),
  component: AboutChurchList,
});

function AboutChurchList() {
  const { language } = useT();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["about_church_entries", isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("about_church_entries")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const entries = q.data ?? [];
  const allPaths = useMemo(() => entries.flatMap((e) => e.photo_urls ?? []), [entries]);
  const signedQ = useQuery({
    queryKey: ["about_church_signed", allPaths.join("|")],
    enabled: allPaths.length > 0,
    queryFn: () => signAboutMedia(allPaths),
  });

  const move = async (e: Entry, dir: -1 | 1) => {
    const list = [...entries];
    const i = list.findIndex((x) => x.id === e.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    await supabase.from("about_church_entries").update({ display_order: b.display_order }).eq("id", a.id);
    await supabase.from("about_church_entries").update({ display_order: a.display_order }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["about_church_entries"] });
  };

  const togglePublish = async (e: Entry) => {
    await supabase.from("about_church_entries").update({ is_published: !e.is_published }).eq("id", e.id);
    qc.invalidateQueries({ queryKey: ["about_church_entries"] });
  };

  const remove = async (e: Entry) => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("about_church_entries").delete().eq("id", e.id);
    qc.invalidateQueries({ queryKey: ["about_church_entries"] });
  };

  return (
    <AppShell>
      <div className="mt-2 flex items-center justify-between">
        <BackButton to="/about" label="About" />
        {isAdmin && (
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-white shadow"
            style={{ background: "var(--brand)" }}>
            <Plus className="h-4 w-4" /> New
          </button>
        )}
      </div>

      <h1 className="font-display text-2xl font-bold mt-3">About Church</h1>
      <p className="text-sm text-muted-foreground font-hi">कलीसिया के बारे में</p>

      {(creating || editing) && isAdmin && (
        <EntryEditor
          entry={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["about_church_entries"] }); }}
        />
      )}

      <div className="mt-4 space-y-3">
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <EmptyState title="Nothing here yet" hint={isAdmin ? "Tap New to add the first entry." : "Check back soon."} />
        ) : entries.map((e, i) => {
          const firstPhoto = e.photo_urls?.[0];
          const url = firstPhoto ? signedQ.data?.[firstPhoto] : undefined;
          return (
            <Card key={e.id} className="overflow-hidden">
              <Link to="/about/church/$id" params={{ id: e.id }} className="tap-card block">
                <div className="flex gap-3 p-3">
                  {url ? (
                    <img src={url} alt="" className="h-20 w-20 rounded-xl object-cover shrink-0" loading="lazy" />
                  ) : (
                    <div className="h-20 w-20 rounded-xl shrink-0" style={{ background: "color-mix(in oklab, var(--lit-purple) 15%, var(--muted))" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{pickLang(e.title_en, e.title_hi, language)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{pickLang(e.body_en, e.body_hi, language)}</p>
                    {!e.is_published && <span className="mt-1 inline-block text-[10px] rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">Draft</span>}
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <div className="flex items-center gap-1 border-t px-2 py-1.5 text-xs">
                  <button onClick={() => move(e, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-accent disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => move(e, 1)} disabled={i === entries.length - 1} className="p-1.5 rounded hover:bg-accent disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button onClick={() => togglePublish(e)} className="p-1.5 rounded hover:bg-accent" title={e.is_published ? "Unpublish" : "Publish"}>
                    {e.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setEditing(e)} className="p-1.5 rounded hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(e)} className="ml-auto p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

function EntryEditor({ entry, onClose, onSaved }: { entry: Entry | null; onClose: () => void; onSaved: () => void }) {
  const [titleEn, setTitleEn] = useState(entry?.title_en ?? "");
  const [titleHi, setTitleHi] = useState(entry?.title_hi ?? "");
  const [bodyEn, setBodyEn] = useState(entry?.body_en ?? "");
  const [bodyHi, setBodyHi] = useState(entry?.body_hi ?? "");
  const [photos, setPhotos] = useState<string[]>(entry?.photo_urls ?? []);
  const [published, setPublished] = useState(entry?.is_published ?? true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    if (photos.length === 0) { setPreviews({}); return; }
    signAboutMedia(photos).then(setPreviews).catch(() => {});
  }, [photos]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const folder = `about-church/${entry?.id ?? "new"}`;
      const uploaded: string[] = [];
      for (const f of Array.from(files)) uploaded.push(await uploadAboutMedia(folder, f));
      setPhotos((p) => [...p, ...uploaded]);
    } catch (e: any) {
      alert(`Upload failed: ${e.message ?? e}`);
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!titleEn.trim() || !bodyEn.trim()) { alert("Title (EN) and Body (EN) are required."); return; }
    setSaving(true);
    try {
      const payload = {
        title_en: titleEn.trim(), title_hi: titleHi.trim() || null,
        body_en: bodyEn.trim(), body_hi: bodyHi.trim() || null,
        photo_urls: photos, is_published: published,
      };
      if (entry) {
        const { error } = await supabase.from("about_church_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("about_church_entries").insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) { alert(`Save failed: ${e.message ?? e}`); }
    finally { setSaving(false); }
  };

  return (
    <Card className="mt-4 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{entry ? "Edit entry" : "New entry"}</h2>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Title (EN) *" className="rounded-lg border px-3 py-2 text-sm bg-background" />
        <input value={titleHi} onChange={(e) => setTitleHi(e.target.value)} placeholder="शीर्षक (HI)" className="rounded-lg border px-3 py-2 text-sm bg-background font-hi" />
      </div>
      <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder="Body (EN) *" rows={4} className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
      <textarea value={bodyHi} onChange={(e) => setBodyHi(e.target.value)} placeholder="विवरण (HI)" rows={4} className="w-full rounded-lg border px-3 py-2 text-sm bg-background font-hi" />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer hover:bg-accent">
            <ImagePlus className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add photos"}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          </label>
          <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
        </div>
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p} className="relative">
                {previews[p] && <img src={previews[p]} alt="" className="h-16 w-full rounded-lg object-cover" />}
                <button onClick={() => setPhotos((arr) => arr.filter((x) => x !== p))}
                  className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground h-5 w-5 grid place-items-center text-xs">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
      </label>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent">Cancel</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-50"
          style={{ background: "var(--brand)" }}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Card>
  );
}
