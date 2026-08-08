import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card, EmptyState } from "../../components/ui-bits";
import { useT, pickLang } from "../../lib/i18n";
import { useIsAdmin } from "../../lib/use-admin";
import { uploadAboutMedia, signAboutMedia } from "../../lib/about-media";
import { Plus, Pencil, Trash2, Eye, EyeOff, ImagePlus, Save, X, Calendar } from "lucide-react";

type Article = {
  id: string;
  article_date: string;
  title_en: string; title_hi: string | null;
  body_en: string; body_hi: string | null;
  photo_urls: string[];
  is_published: boolean;
};

export const Route = createFileRoute("/about/timeline/")({
  head: () => ({
    meta: [
      { title: "Church Timeline — Church Companion" },
      { name: "description", content: "Day-wise history of the parish." },
    ],
  }),
  component: TimelineList,
});

function TimelineList() {
  const { language } = useT();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["timeline_articles", isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("church_timeline_articles")
        .select("*")
        .order("article_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Article[];
    },
  });

  const articles = q.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of articles) {
      const d = new Date(a.article_date + "T00:00:00");
      const key = d.toLocaleString("en-US", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [articles]);

  const firstPaths = useMemo(() => articles.map((a) => a.photo_urls?.[0]).filter(Boolean) as string[], [articles]);
  const signedQ = useQuery({
    queryKey: ["timeline_thumbs", firstPaths.join("|")],
    enabled: firstPaths.length > 0,
    queryFn: () => signAboutMedia(firstPaths),
  });

  const remove = async (a: Article) => {
    if (!confirm("Delete this article? Comments & likes will also be removed.")) return;
    await supabase.from("church_timeline_articles").delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["timeline_articles"] });
  };
  const togglePublish = async (a: Article) => {
    await supabase.from("church_timeline_articles").update({ is_published: !a.is_published }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["timeline_articles"] });
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

      <h1 className="font-display text-2xl font-bold mt-3">Church Timeline</h1>
      <p className="text-sm text-muted-foreground font-hi">कलीसिया का इतिहास</p>

      {(creating || editing) && isAdmin && (
        <ArticleEditor
          article={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["timeline_articles"] }); }}
        />
      )}

      <div className="mt-4 space-y-6">
        {q.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : articles.length === 0 ? (
          <EmptyState title="No articles yet" hint={isAdmin ? "Tap New to add the first article." : "Check back soon."} />
        ) : grouped.map(([month, items]) => (
          <div key={month}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">{month}</h2>
            <div className="space-y-2">
              {items.map((a) => {
                const first = a.photo_urls?.[0];
                const url = first ? signedQ.data?.[first] : undefined;
                const d = new Date(a.article_date + "T00:00:00");
                return (
                  <Card key={a.id} className="overflow-hidden">
                    <Link to="/about/timeline/$id" params={{ id: a.id }} className="tap-card flex gap-3 p-3">
                      {url ? (
                        <img src={url} alt="" className="h-20 w-20 rounded-xl object-cover shrink-0" loading="lazy" />
                      ) : (
                        <div className="h-20 w-20 rounded-xl shrink-0 grid place-items-center text-white font-semibold"
                          style={{ background: "linear-gradient(140deg, #B45309, #78350F)" }}>
                          <div className="text-center leading-tight">
                            <div className="text-lg">{d.getDate()}</div>
                            <div className="text-[10px] opacity-80 uppercase">{d.toLocaleString("en-US", { month: "short" })}</div>
                          </div>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{d.toLocaleDateString()}</p>
                        <p className="font-semibold truncate">{pickLang(a.title_en, a.title_hi, language)}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{pickLang(a.body_en, a.body_hi, language)}</p>
                        {!a.is_published && <span className="mt-1 inline-block text-[10px] rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">Draft</span>}
                      </div>
                    </Link>
                    {isAdmin && (
                      <div className="flex items-center gap-1 border-t px-2 py-1.5 text-xs">
                        <button onClick={() => togglePublish(a)} className="p-1.5 rounded hover:bg-accent">
                          {a.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => setEditing(a)} className="p-1.5 rounded hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(a)} className="ml-auto p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function ArticleEditor({ article, onClose, onSaved }: { article: Article | null; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(article?.article_date ?? today);
  const [titleEn, setTitleEn] = useState(article?.title_en ?? "");
  const [titleHi, setTitleHi] = useState(article?.title_hi ?? "");
  const [bodyEn, setBodyEn] = useState(article?.body_en ?? "");
  const [bodyHi, setBodyHi] = useState(article?.body_hi ?? "");
  const [photos, setPhotos] = useState<string[]>(article?.photo_urls ?? []);
  const [published, setPublished] = useState(article?.is_published ?? true);
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
      const folder = `timeline/${article?.id ?? "new"}`;
      const uploaded: string[] = [];
      for (const f of Array.from(files)) uploaded.push(await uploadAboutMedia(folder, f));
      setPhotos((p) => [...p, ...uploaded]);
    } catch (e: any) { alert(`Upload failed: ${e.message ?? e}`); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!titleEn.trim() || !bodyEn.trim() || !date) { alert("Date, Title (EN) and Body (EN) are required."); return; }
    setSaving(true);
    try {
      const payload = {
        article_date: date,
        title_en: titleEn.trim(), title_hi: titleHi.trim() || null,
        body_en: bodyEn.trim(), body_hi: bodyHi.trim() || null,
        photo_urls: photos, is_published: published,
      };
      if (article) {
        const { error } = await supabase.from("church_timeline_articles").update(payload).eq("id", article.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("church_timeline_articles").insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) { alert(`Save failed: ${e.message ?? e}`); }
    finally { setSaving(false); }
  };

  return (
    <Card className="mt-4 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{article ? "Edit article" : "New article"}</h2>
        <button type="button" onClick={onClose} aria-label="Close editor" data-icon-button className="hit-target focus-ring grid h-9 w-9 place-items-center rounded-full transition-colors duration-200 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <label className="block text-xs font-medium">Article date *
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-background" />
      </label>
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
