import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { useT, pickLang } from "../../lib/i18n";
import { useIsAdmin } from "../../lib/use-admin";
import { signAboutMedia } from "../../lib/about-media";
import { getClientId } from "../../lib/client-id";
import { Heart, MessageCircle, Trash2, EyeOff, Eye, Calendar, Send } from "lucide-react";

export const Route = createFileRoute("/about/timeline/$id")({
  component: TimelineDetail,
});

function TimelineDetail() {
  const { id } = useParams({ from: "/about/timeline/$id" });
  const { language } = useT();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const clientId = getClientId();

  const articleQ = useQuery({
    queryKey: ["timeline_article", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("church_timeline_articles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const paths = useMemo(() => articleQ.data?.photo_urls ?? [], [articleQ.data]);
  const signedQ = useQuery({
    queryKey: ["timeline_article_signed", id, paths.join("|")],
    enabled: paths.length > 0,
    queryFn: () => signAboutMedia(paths),
  });

  const likesQ = useQuery({
    queryKey: ["timeline_likes", id],
    queryFn: async () => {
      const { count } = await supabase.from("timeline_article_likes").select("id", { count: "exact", head: true }).eq("article_id", id);
      const { data } = await supabase.from("timeline_article_likes").select("id").eq("article_id", id).eq("liker_client_id", clientId).maybeSingle();
      return { count: count ?? 0, liked: !!data };
    },
  });

  const commentsQ = useQuery({
    queryKey: ["timeline_comments", id, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase.from("timeline_article_comments")
        .select("*").eq("article_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleLike = async () => {
    if (!likesQ.data) return;
    if (likesQ.data.liked) {
      await supabase.from("timeline_article_likes").delete().eq("article_id", id).eq("liker_client_id", clientId);
    } else {
      await supabase.from("timeline_article_likes").insert({ article_id: id, liker_client_id: clientId });
    }
    qc.invalidateQueries({ queryKey: ["timeline_likes", id] });
  };

  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const post = async () => {
    if (!name.trim() || !text.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("timeline_article_comments").insert({
        article_id: id, commenter_name: name.trim(), comment_text: text.trim(),
      });
      if (error) throw error;
      setText("");
      qc.invalidateQueries({ queryKey: ["timeline_comments", id] });
    } catch (e: any) { alert(`Failed: ${e.message ?? e}`); }
    finally { setPosting(false); }
  };

  const hideComment = async (cId: string, hide: boolean) => {
    await supabase.from("timeline_article_comments").update({ is_hidden: hide }).eq("id", cId);
    qc.invalidateQueries({ queryKey: ["timeline_comments", id] });
  };
  const deleteComment = async (cId: string) => {
    if (!confirm("Delete this comment?")) return;
    await supabase.from("timeline_article_comments").delete().eq("id", cId);
    qc.invalidateQueries({ queryKey: ["timeline_comments", id] });
  };

  const a = articleQ.data;

  return (
    <AppShell>
      <div className="mt-2 text-xs text-muted-foreground">
        <BackButton to="/about/timeline" label="Timeline" />
      </div>
      {articleQ.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : !a ? (
        <p className="mt-4 text-sm text-muted-foreground">Not found.</p>
      ) : (
        <>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(a.article_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <h1 className="font-display text-2xl font-bold">{pickLang(a.title_en, a.title_hi, language)}</h1>

          {paths.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {paths.map((p: string) => signedQ.data?.[p] && (
                <img key={p} src={signedQ.data[p]} alt="" className="w-full rounded-xl object-cover aspect-square" loading="lazy" />
              ))}
            </div>
          )}

          <Card className="mt-4 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{pickLang(a.body_en, a.body_hi, language)}</p>
          </Card>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={toggleLike}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${likesQ.data?.liked ? "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30" : "hover:bg-accent"}`}>
              <Heart className={`h-4 w-4 ${likesQ.data?.liked ? "fill-current" : ""}`} />
              {likesQ.data?.count ?? 0}
            </button>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" /> {commentsQ.data?.length ?? 0}
            </span>
          </div>

          <section className="mt-6">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Comments</h2>

            <Card className="p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60}
                  className="col-span-1 rounded-lg border px-3 py-2 text-sm bg-background" />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" maxLength={500}
                  onKeyDown={(e) => { if (e.key === "Enter") post(); }}
                  className="col-span-2 rounded-lg border px-3 py-2 text-sm bg-background" />
              </div>
              <div className="flex justify-end">
                <button onClick={post} disabled={posting || !name.trim() || !text.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-50"
                  style={{ background: "var(--brand)" }}>
                  <Send className="h-3.5 w-3.5" /> Post
                </button>
              </div>
            </Card>

            <ul className="mt-3 space-y-2">
              {(commentsQ.data ?? []).map((c: any) => (
                <li key={c.id} className={`rounded-xl border p-3 ${c.is_hidden ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{c.commenter_name}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{c.comment_text}</p>
                  {isAdmin && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <button onClick={() => hideComment(c.id, !c.is_hidden)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent">
                        {c.is_hidden ? <><Eye className="h-3 w-3" /> Show</> : <><EyeOff className="h-3 w-3" /> Hide</>}
                      </button>
                      <button onClick={() => deleteComment(c.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-destructive/10 text-destructive">
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {(commentsQ.data ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground text-center py-6">Be the first to comment.</li>
              )}
            </ul>
          </section>
        </>
      )}
    </AppShell>
  );
}
