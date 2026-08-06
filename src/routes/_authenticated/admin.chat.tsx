import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";

export const Route = createFileRoute("/_authenticated/admin/chat")({
  component: AdminChat,
  head: () => ({
    meta: [
      { title: "Chat moderation · Church Companion" },
      { name: "description", content: "Moderate congregation and youth chat: reports and mutes." },
      { property: "og:title", content: "Chat moderation · Church Companion" },
      { property: "og:description", content: "Moderate congregation and youth chat: reports and mutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminChat() {
  const qc = useQueryClient();
  const [mute, setMute] = useState({ ref: "", minutes: "60" });

  const reportsQ = useQuery({
    queryKey: ["admin-chat-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_reports")
        .select("*, chat_messages(id, channel, sender_name, sender_ref, content, deleted)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutesQ = useQuery({
    queryKey: ["admin-chat-mutes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_mutes").select("*").order("muted_until", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMute = async (ref?: string) => {
    const target = (ref ?? mute.ref).trim();
    if (!target) return;
    const until = new Date(Date.now() + Number(mute.minutes || 60) * 60000).toISOString();
    const { error } = await supabase.from("chat_mutes").insert({ sender_ref: target, muted_until: until });
    if (error) { window.alert(error.message); return; }
    setMute({ ...mute, ref: "" });
    void qc.invalidateQueries({ queryKey: ["admin-chat-mutes"] });
  };

  const liftMute = async (id: string) => {
    await supabase.from("chat_mutes").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["admin-chat-mutes"] });
  };

  const softDelete = async (messageId: string, reportId: string) => {
    await supabase.from("chat_messages").update({ deleted: true }).eq("id", messageId);
    await supabase.from("chat_reports").update({ resolved: true }).eq("id", reportId);
    void qc.invalidateQueries({ queryKey: ["admin-chat-reports"] });
  };

  const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 brand-ring";
  const btn = "rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white active:scale-95 transition";

  return (
    <AppShell title="Chat moderation" left={<BackButton to="/admin/dashboard" />}>
      <div className="mt-4 space-y-4">
        <Card className="space-y-3 p-4">
          <h2 className="font-display text-base font-bold">Reports / रिपोर्ट</h2>
          {(reportsQ.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nothing reported.</p>}
          {(reportsQ.data ?? []).map((r: any) => (
            <div key={r.id} className="rounded-xl border p-3 text-xs">
              <p className="font-medium">{r.chat_messages?.sender_name} · {r.chat_messages?.channel}</p>
              <p className="mt-1 text-muted-foreground font-hi">{r.chat_messages?.content ?? "📷 image"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={btn} onClick={() => softDelete(r.chat_messages.id, r.id)}>Delete message</button>
                <button className={btn} onClick={() => addMute(r.chat_messages.sender_ref)}>Mute sender</button>
                {r.resolved && <span className="self-center text-muted-foreground">resolved</span>}
              </div>
            </div>
          ))}
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-display text-base font-bold">Mutes / म्यूट</h2>
          <div className="flex gap-2">
            <input className={input} placeholder="sender_ref" value={mute.ref} onChange={(e) => setMute({ ...mute, ref: e.target.value })} />
            <input className={input} placeholder="minutes" value={mute.minutes} onChange={(e) => setMute({ ...mute, minutes: e.target.value })} />
            <button className={btn} onClick={() => addMute()}>Mute</button>
          </div>
          <ul className="space-y-1 text-xs">
            {(mutesQ.data ?? []).map((m: any) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="truncate">{m.sender_ref} → {new Date(m.muted_until).toLocaleString()}</span>
                <button className="text-destructive" onClick={() => liftMute(m.id)}>Lift</button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
