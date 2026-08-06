import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Users, WifiOff } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { useT } from "../../lib/i18n";
import { flushChatOutbox, pendingMessages, queueMessage } from "../../lib/chat-outbox";
import {
  PAGE_SIZE,
  getIdentity,
  joinCongregation,
  joinRoom,
  joinYouth,
  listMessages,
  heartbeat,
  refreshSession,
  requestYouthAccess,
  senderFor,
  sendMessage,
  setLastSeen,
  onYouthRosterChange,
  youthRequestStatus,
  type ChatChannel,
  type ChatMessage,
  type OnlineUser,
} from "../../lib/chat";
import { cn } from "../../lib/utils";

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

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function ChatThread() {
  const { channel: raw } = useParams({ from: "/chat/$channel" });
  const channel: ChatChannel = raw === "youth" ? "youth" : "congregation";
  const { t } = useT();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void refreshSession(channel).then(() => setTick((n) => n + 1));
    const off = channel === "youth"
      ? onYouthRosterChange(() => void refreshSession(channel).then(() => setTick((n) => n + 1)))
      : () => {};
    return off;
  }, [channel]);

  const identity = useMemo(() => {
    void tick;
    if (typeof window === "undefined") return null;
    return getIdentity(channel);
  }, [channel, tick]);

  const title = channel === "youth"
    ? `${t("chat.youth")} / युवा चैट`
    : `${t("chat.congregation")} / मण्डली चैट`;

  if (!identity) {
    return (
      <AppShell left={<BackButton to="/chat" />}>
        <h1 className="pt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <Gate channel={channel} onJoined={() => setTick((n) => n + 1)} />
      </AppShell>
    );
  }

  return <Room channel={channel} title={title} />;
}

/* ------------------------------------------------------------------ */
/* Entry gates                                                         */
/* ------------------------------------------------------------------ */

function Gate({ channel, onJoined }: { channel: ChatChannel; onJoined: () => void }) {
  return channel === "youth"
    ? <YouthGate onJoined={onJoined} />
    : <CongregationGate onJoined={onJoined} />;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

function CongregationGate({ onJoined }: { onJoined: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await joinCongregation(name, phone);
      onJoined();
    } catch (err) {
      setError((err as Error).message || "Could not join");
    } finally { setBusy(false); }
  };

  return (
    <Card className="mt-5 p-5">
      <h2 className="text-lg font-semibold">Join the congregation chat</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your name and phone number once. We remember you on this device.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
        <Field placeholder="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Joining…" : "Enter chat"}
        </button>
      </form>
    </Card>
  );
}

function YouthGate({ onJoined }: { onJoined: () => void }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState<{ status: string; rejection_reason: string | null } | null>(null);

  const [reqName, setReqName] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [sent, setSent] = useState(false);

  const check = useCallback(async (silent = false) => {
    if (!phone.trim()) return;
    setBusy(true); setError(null);
    try {
      const id = await joinYouth(phone);
      if (id) { onJoined(); return; }
      setDenied(true);
      setStatus(await youthRequestStatus(phone));
    } catch (err) {
      if (!silent) setError((err as Error).message || "Could not verify");
    } finally { setBusy(false); }
  }, [phone, onJoined]);

  // An admin approval should let the member in without re-typing anything.
  useEffect(() => {
    if (!denied) return;
    return onYouthRosterChange(() => void check(true));
  }, [denied, check]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await requestYouthAccess(reqName, phone, reqMessage);
      setSent(true);
      setStatus({ status: "pending", rejection_reason: null });
    } catch (err) {
      setError((err as Error).message || "Could not send request");
    } finally { setBusy(false); }
  };

  return (
    <Card className="mt-5 p-5">
      <h2 className="text-lg font-semibold">Youth chat access</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the phone number registered with the youth group.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); void check(); }} className="mt-4 space-y-3">
        <Field placeholder="Phone number" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setDenied(false); setSent(false); }} required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </form>

      {denied && (
        <div className="mt-5 rounded-2xl border border-border p-4">
          {status?.status === "pending" || sent ? (
            <p className="text-sm">
              Your request is <span className="font-semibold">pending</span>. You will be let in
              automatically once an admin approves it.
            </p>
          ) : status?.status === "rejected" ? (
            <div className="space-y-2 text-sm">
              <p>Your last request was <span className="font-semibold">rejected</span>.</p>
              {status.rejection_reason && (
                <p className="text-muted-foreground">Reason: {status.rejection_reason}</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold">This number is not on the approved list.</p>
              <form onSubmit={submitRequest} className="mt-3 space-y-3">
                <Field placeholder="Your name" value={reqName} onChange={(e) => setReqName(e.target.value)} maxLength={50} required />
                <textarea
                  placeholder="Message to the admin (optional)"
                  value={reqMessage}
                  onChange={(e) => setReqMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-2xl border border-primary px-4 py-3 font-semibold text-primary transition active:scale-[0.98] disabled:opacity-50"
                >
                  Request access
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

function Room({ channel, title }: { channel: ChatChannel; title: string }) {
  const me = senderFor(channel);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [showOnline, setShowOnline] = useState(false);
  const [text, setText] = useState("");
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const room = useRef<ReturnType<typeof joinRoom> | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingSent = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const scrollToEnd = useCallback((smooth = false) => {
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  }, []);

  // Initial load
  useEffect(() => {
    let alive = true;
    setLoading(true);
    listMessages(channel)
      .then((rows) => {
        if (!alive) return;
        setMessages(rows);
        setExhausted(rows.length < PAGE_SIZE);
        scrollToEnd();
      })
      .catch(() => { /* offline with empty cache */ })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [channel, scrollToEnd]);

  // Realtime room: presence, typing, message fan-out
  useEffect(() => {
    const r = joinRoom(channel, {
      onMessage: (m) => {
        if (m.sender_ref === me?.ref) return;
        merge([m]);
        setTyping((prev) => { const next = { ...prev }; delete next[m.sender_ref]; return next; });
        const el = scroller.current;
        const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 200;
        if (nearBottom) scrollToEnd(true);
      },
      onTyping: (p) => {
        if (p.phone_number === me?.ref) return;
        setTyping((prev) => {
          const next = { ...prev };
          if (p.is_typing) next[p.phone_number] = p.sender_name;
          else delete next[p.phone_number];
          return next;
        });
        clearTimeout(typingTimers.current[p.phone_number]);
        if (p.is_typing) {
          typingTimers.current[p.phone_number] = setTimeout(() => {
            setTyping((prev) => { const next = { ...prev }; delete next[p.phone_number]; return next; });
          }, 3000);
        }
      },
      onPresence: setOnline,
    });
    room.current = r;
    return () => { r.leave(); room.current = null; };
  }, [channel, me?.ref, merge, scrollToEnd]);

  // Presence heartbeat
  useEffect(() => {
    void heartbeat(channel);
    const id = setInterval(() => void heartbeat(channel), 30000);
    return () => clearInterval(id);
  }, [channel]);

  // Connectivity + outbox drain
  useEffect(() => {
    const refresh = async () => {
      setQueued((await pendingMessages(channel)).length);
    };
    void refresh();
    const onOnline = async () => {
      setOffline(false);
      await flushChatOutbox(channel);
      await refresh();
      try { merge(await listMessages(channel)); } catch { /* ignore */ }
    };
    const onOff = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOff);
    };
  }, [channel, merge]);

  // Mark read
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) setLastSeen(channel, last.created_at);
  }, [channel, messages]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || exhausted || !messages.length) return;
    setLoadingMore(true);
    const el = scroller.current;
    const before = el?.scrollHeight ?? 0;
    try {
      const older = await listMessages(channel, { before: messages[0].created_at });
      if (older.length < PAGE_SIZE) setExhausted(true);
      merge(older);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } catch { setExhausted(true); }
    finally { setLoadingMore(false); }
  }, [channel, exhausted, loadingMore, merge, messages]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el && el.scrollTop < 80) void loadOlder();
  }, [loadOlder]);

  const onType = (value: string) => {
    setText(value);
    if (!typingSent.current) {
      typingSent.current = true;
      room.current?.sendTyping(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      typingSent.current = false;
      room.current?.sendTyping(false);
    }, 500 + 2500);
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText(""); setError(null);
    typingSent.current = false;
    room.current?.sendTyping(false);
    try {
      const msg = await sendMessage(channel, { content: body });
      merge([msg]);
      room.current?.broadcastMessage(msg);
      scrollToEnd(true);
    } catch (err) {
      const message = (err as Error).message || "";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueMessage(channel, body, null);
        setQueued((n) => n + 1);
      } else {
        setError(message.includes("Slow down") ? "Slow down — one message per second." : message);
      }
    }
  };

  const typingNames = Object.values(typing);

  return (
    <AppShell
      left={<BackButton to="/chat" />}
      right={
        <button
          onClick={() => setShowOnline((v) => !v)}
          aria-label="Online members"
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
        >
          <Users className="h-4 w-4" />
          {online.length}
        </button>
      }
    >
      <header className="pt-4">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {online.length} online
          {offline && " · offline"}
          {queued > 0 && ` · ${queued} queued`}
        </p>
      </header>

      <AnimatePresence>
        {showOnline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="mt-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Online now</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {online.length === 0 && <li className="text-muted-foreground">Nobody else right now.</li>}
                {online.map((u) => (
                  <li key={u.phone} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {u.name}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {offline && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs text-muted-foreground">
          <WifiOff className="h-4 w-4" /> You are offline — messages will send when you reconnect.
        </div>
      )}

      <div
        ref={scroller}
        onScroll={onScroll}
        className="mt-3 flex-1 space-y-1 overflow-y-auto pb-40"
        style={{ maxHeight: "calc(100dvh - 15rem)" }}
      >
        {loadingMore && (
          <div className="flex justify-center py-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {loading && (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello.</p>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          const mine = m.sender_ref === me?.ref;
          const grouped = !!prev && !newDay && prev.sender_ref === m.sender_ref;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn("flex", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm",
                    mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card rounded-bl-md",
                  )}
                >
                  {!mine && !grouped && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">{m.sender_name}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={cn("mt-1 text-[10px] tabular-nums", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {timeLabel(m.created_at)}
                  </p>
                </div>
              </motion.div>
            </div>
          );
        })}

        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="pt-2 text-xs italic text-muted-foreground"
            >
              {typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.length} people are typing…`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="pt-2 text-xs text-destructive">{error}</p>}

      <div
        className="fixed inset-x-0 z-40 flex items-end gap-2 px-4"
        style={{ bottom: "calc(var(--dock-space) + 0.75rem)" }}
      >
        <div className="glass mx-auto flex w-full max-w-screen-sm items-end gap-2 rounded-3xl p-2">
          <textarea
            value={text}
            rows={1}
            maxLength={500}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            placeholder="Message"
            className="max-h-28 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none"
          />
          <button
            onClick={() => void send()}
            disabled={!text.trim()}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
