import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCheck, ImagePlus, Send, Trash2, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useT } from "../../lib/i18n";
import { useIsAdmin } from "../../lib/use-admin";
import { flushChatOutbox, pendingMessages, queueMessage } from "../../lib/chat-outbox";
import {
  REACTION_EMOJIS,
  checkYouthPhone,
  getCongregationIdentity,
  getYouthIdentity,
  refreshYouthSession,
  listMessages,
  listReactions,
  markRead,
  presenceChannelName,
  readCounts,
  registerCongregation,
  reportMessage,
  sendMessage,
  senderFor,
  setLastSeen,
  signChatMedia,
  toggleReaction,
  uploadChatImage,
  type ChatChannel,
  type ChatMessage,
} from "../../lib/chat";

export const Route = createFileRoute("/chat/$channel")({
  component: ChatThread,
  head: () => ({
    meta: [
      { title: "Chat room · Church Companion" },
      { name: "description", content: "Live congregation and youth conversation in Church Companion." },
      { property: "og:title", content: "Chat room · Church Companion" },
      { property: "og:description", content: "Live congregation and youth conversation in Church Companion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChatThread() {
  const { channel: raw } = useParams({ from: "/chat/$channel" });
  const channel: ChatChannel = raw === "youth" ? "youth" : "congregation";
  const navigate = useNavigate();
  const { t } = useT();
  const [identityTick, setIdentityTick] = useState(0);

  // Keep an already-approved youth session alive silently — never re-ask.
  useEffect(() => {
    if (channel !== "youth") return;
    void refreshYouthSession().then(() => setIdentityTick((n) => n + 1));
  }, [channel]);

  const identity = useMemo(() => {
    void identityTick;
    if (typeof window === "undefined") return null;
    return senderFor(channel);
  }, [channel, identityTick]);


  const title = channel === "youth" ? `${t("chat.youth")} / युवा चैट` : `${t("chat.congregation")} / मण्डली चैट`;

  if (!identity) {
    return (
      <AppShell title={title} left={<BackButton to="/chat" />}>
        {channel === "youth" ? (
          <YouthGate onDone={() => setIdentityTick((n) => n + 1)} />
        ) : (
          <CongregationGate onDone={() => setIdentityTick((n) => n + 1)} />
        )}
      </AppShell>
    );
  }

  return <Thread channel={channel} title={title} onLeave={() => navigate({ to: "/chat" })} />;
}

// ---------------- Identity gates ----------------

function CongregationGate({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return;
    setBusy(true); setErr(null);
    try {
      await registerCongregation(form.name, form.email, form.phone);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Card className="mt-6 space-y-3 p-5">
      <h2 className="font-display text-lg font-bold">{t("chat.join_title")}</h2>
      <p className="text-xs text-muted-foreground font-hi">{t("chat.join_hint")}</p>
      {(["name", "email", "phone"] as const).map((k) => (
        <input
          key={k}
          value={form[k]}
          onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          placeholder={t(`chat.${k}`)}
          type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 brand-ring"
        />
      ))}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition disabled:opacity-60"
      >
        {t("chat.continue")}
      </button>
    </Card>
  );
}

function YouthGate({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const submit = async () => {
    if (!phone.trim()) return;
    setBusy(true); setDenied(false);
    try {
      const y = await checkYouthPhone(phone);
      if (y) onDone(); else setDenied(true);
    } catch { setDenied(true); } finally { setBusy(false); }
  };

  return (
    <Card className="mt-6 space-y-3 p-5">
      <h2 className="font-display text-lg font-bold">{t("chat.youth_gate")}</h2>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        type="tel"
        placeholder="+91…"
        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 brand-ring"
      />
      {denied && <p className="text-xs text-destructive font-hi">{t("chat.youth_denied")}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition disabled:opacity-60"
      >
        {t("chat.continue")}
      </button>
    </Card>
  );
}

// ---------------- Thread ----------------

function Thread({ channel, title, onLeave }: { channel: ChatChannel; title: string; onLeave: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const me = senderFor(channel)!;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(true);
  const [connected, setConnected] = useState(false);
  const [typers, setTypers] = useState<string[]>([]);
  const [present, setPresent] = useState(0);
  const [picker, setPicker] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);
  const roomRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingRef = useRef(0);

  const messagesQ = useQuery({
    queryKey: ["chat-messages", channel],
    queryFn: () => listMessages(channel),
    refetchInterval: channel === "youth" ? 6000 : 20000,
  });
  const messages = useMemo(() => messagesQ.data ?? [], [messagesQ.data]);
  const ids = useMemo(() => messages.map((m) => m.id), [messages]);

  const reactionsQ = useQuery({
    queryKey: ["chat-reactions", channel, ids.length, ids[ids.length - 1] ?? ""],
    enabled: ids.length > 0,
    queryFn: () => listReactions(channel, ids),
  });

  const receiptsQ = useQuery({
    queryKey: ["chat-receipts", channel, ids.length, ids[ids.length - 1] ?? ""],
    enabled: ids.length > 0,
    refetchInterval: 5000,
    queryFn: () => readCounts(channel, ids),
  });

  const mediaPaths = useMemo(() => messages.map((m) => m.media_url).filter(Boolean) as string[], [messages]);
  const mediaQ = useQuery({
    queryKey: ["chat-media", channel, mediaPaths.join("|")],
    enabled: mediaPaths.length > 0,
    queryFn: () => signChatMedia(mediaPaths),
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["chat-messages", channel] });
  }, [qc, channel]);

  // Connectivity + queued sends
  useEffect(() => {
    const sync = async () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        const sent = await flushChatOutbox(channel);
        if (sent) refresh();
      }
      setQueued((await pendingMessages(channel)).length);
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, [channel, refresh]);

  // Realtime: message stream, typing broadcast, presence
  useEffect(() => {
    const room = supabase.channel(presenceChannelName(channel), {
      config: { presence: { key: me.ref } },
    });
    room
      .on("postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `channel=eq.${channel}` },
        () => refresh())
      .on("broadcast", { event: "new-message" }, () => refresh())
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { ref: string; name: string };
        if (p.ref === me.ref) return;
        setTypers((prev) => (prev.includes(p.name) ? prev : [...prev, p.name]));
        window.setTimeout(() => setTypers((prev) => prev.filter((n) => n !== p.name)), 3000);
      })
      .on("presence", { event: "sync" }, () => {
        setPresent(Object.keys(room.presenceState()).length);
      })
      .subscribe(async (status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") await room.track({ name: me.name, at: Date.now() });
      });
    roomRef.current = room;
    return () => { roomRef.current = null; void supabase.removeChannel(room); };
  }, [channel, me.ref, me.name, refresh]);

  // Read receipts + last-seen
  useEffect(() => {
    if (!messages.length) return;
    void markRead(channel, messages);
    setLastSeen(channel, messages[messages.length - 1].created_at);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, channel]);

  const onType = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (now - lastTypingRef.current > 1000 && roomRef.current) {
      lastTypingRef.current = now;
      void roomRef.current.send({ type: "broadcast", event: "typing", payload: { ref: me.ref, name: me.name } });
    }
  };

  const send = async (media_url?: string) => {
    const content = draft.trim();
    if (!content && !media_url) return;
    setDraft("");
    try {
      await sendMessage(channel, { content: content || null, media_url: media_url ?? null });
      void roomRef.current?.send({ type: "broadcast", event: "new-message", payload: {} });
      refresh();
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!navigator.onLine || msg.includes("Failed to fetch")) {
        await queueMessage(channel, content || null, media_url ?? null);
        setQueued((n) => n + 1);
      } else {
        window.alert(msg);
      }
    }
  };

  const attach = async (file: File) => {
    try {
      const path = await uploadChatImage(channel, file);
      await send(path);
    } catch (e) { window.alert((e as Error).message); }
  };

  const react = async (id: string, emoji: string) => {
    setPicker(null);
    await toggleReaction(channel, id, emoji);
    void qc.invalidateQueries({ queryKey: ["chat-reactions", channel] });
  };

  const report = async (id: string) => {
    setPicker(null);
    await reportMessage(channel, id, "Reported from chat");
    window.alert(t("chat.reported"));
  };

  const adminDelete = async (id: string) => {
    await supabase.from("chat_messages").update({ deleted: true }).eq("id", id);
    refresh();
  };

  const reactionsFor = (id: string) => (reactionsQ.data ?? []).filter((r) => r.message_id === id);

  return (
    <AppShell
      title={title}
      hideNav
      left={<BackButton to="/chat" />}
      right={<span className="shrink-0 text-[11px] text-muted-foreground">{present} {t("chat.online")}</span>}
    >
      {(!online || !connected) && (
        <div className="sticky top-0 z-10 mt-2 flex items-center gap-2 rounded-xl bg-destructive/15 px-3 py-2 text-xs text-destructive">
          <WifiOff className="h-4 w-4" /> {t("chat.reconnecting")}
        </div>
      )}
      {queued > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground font-hi">{t("chat.queued")} ({queued})</p>
      )}

      <div className="space-y-1.5 pb-32 pt-3">
        {messagesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground font-hi">{t("chat.no_messages")}</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_ref === me.ref;
            const prev = messages[i - 1];
            const startsRun = !prev || prev.sender_ref !== m.sender_ref;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                mine={mine}
                showName={startsRun && !mine}
                reactions={reactionsFor(m.id)}
                readBy={receiptsQ.data?.[m.id] ?? 0}
                mediaUrl={m.media_url ? mediaQ.data?.[m.media_url] : undefined}
                open={picker === m.id}
                isAdmin={isAdmin}
                onOpen={() => setPicker(picker === m.id ? null : m.id)}
                onReact={(e) => react(m.id, e)}
                onReport={() => report(m.id)}
                onDelete={() => adminDelete(m.id)}
                onExpand={(url) => setLightbox(url)}
              />
            );
          })
        )}

        <AnimatePresence>
          {typers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2 px-1 pt-1 text-xs text-muted-foreground"
            >
              <span className="flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-current"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                  />
                ))}
              </span>
              <span className="font-hi">{typers.join(", ")} {t("chat.typing")}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div
        className="fixed inset-x-0 z-30 flex justify-center"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
          paddingLeft: "calc(var(--app-gutter) + var(--sal))",
          paddingRight: "calc(var(--app-gutter) + var(--sar))",
        }}
      >
        <div className="dock-pill flex w-full max-w-[min(100%,var(--app-max-w))] items-center gap-2 rounded-full px-2 py-1.5">
          <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground active:scale-95 transition">
            <ImagePlus className="h-5 w-5" />
            <span className="sr-only">{t("chat.attach")}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); e.currentTarget.value = ""; }}
            />
          </label>
          <input
            value={draft}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={t("chat.message_ph")}
            className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none font-hi"
          />
          <button
            onClick={() => void send()}
            aria-label={t("chat.send")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white active:scale-95 transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox images={[lightbox]} index={0} onClose={() => setLightbox(null)} />
      )}
      <button className="sr-only" onClick={onLeave}>{t("common.back")}</button>
    </AppShell>
  );
}

function MessageBubble({
  message, mine, showName, reactions, readBy, mediaUrl, open, isAdmin,
  onOpen, onReact, onReport, onDelete, onExpand,
}: {
  message: ChatMessage;
  mine: boolean;
  showName: boolean;
  reactions: { emoji: string }[];
  readBy: number;
  mediaUrl?: string;
  open: boolean;
  isAdmin: boolean;
  onOpen: () => void;
  onReact: (emoji: string) => void;
  onReport: () => void;
  onDelete: () => void;
  onExpand: (url: string) => void;
}) {
  const { t } = useT();
  const pressTimer = useRef<number | null>(null);
  const [showTime, setShowTime] = useState(false);

  const startPress = () => {
    pressTimer.current = window.setTimeout(() => { onOpen(); setShowTime(true); }, 420);
  };
  const endPress = () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); };

  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {showName && <span className="px-2 pb-0.5 text-[11px] font-medium text-muted-foreground font-hi">{message.sender_name}</span>}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => { e.preventDefault(); onOpen(); }}
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
          mine
            ? "bg-[var(--brand)] text-white rounded-br-md"
            : "glass rounded-bl-md"
        }`}
      >
        {mediaUrl && (
          <button type="button" onClick={() => onExpand(mediaUrl)} className="mb-1 block overflow-hidden rounded-xl">
            <img src={mediaUrl} alt="" className="max-h-64 w-full object-cover" loading="lazy" />
          </button>
        )}
        {message.content && <p className="whitespace-pre-wrap break-words font-hi">{message.content}</p>}
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>
          {showTime && <span>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
          {mine && (readBy > 0 ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
        </div>
      </motion.div>

      {Object.keys(grouped).length > 0 && (
        <div className="-mt-1 flex gap-1 px-1">
          {Object.entries(grouped).map(([emoji, count]) => (
            <span key={emoji} className="glass rounded-full px-1.5 py-0.5 text-[11px]">{emoji} {count}</span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass mt-1 flex items-center gap-1 rounded-full px-2 py-1"
          >
            {REACTION_EMOJIS.map((e) => (
              <button key={e} onClick={() => onReact(e)} className="px-1 text-base active:scale-90 transition">{e}</button>
            ))}
            <button onClick={onReport} aria-label={t("chat.report")} className="px-1 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button onClick={onDelete} aria-label="Delete" className="px-1 text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
