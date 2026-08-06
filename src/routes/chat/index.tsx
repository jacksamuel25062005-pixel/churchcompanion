import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Archive, Bell, BellOff, Camera, Check, CheckCheck, FileText, Image as ImageIcon,
  Lock, MessagesSquare, Mic, MoreVertical, Pin, PinOff, Search, Sparkles, Star, Users, X,
} from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { BackButton } from "../../components/ui-bits";
import { useT } from "../../lib/i18n";
import { lastMessage, unreadCount, getYouthIdentity, type ChatChannel, type ChatMessage } from "../../lib/chat";
import { allPrefs, getPrefs, onPrefsChange, togglePref, type ChatPrefs } from "../../lib/chat-prefs";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/chat/")({
  component: ChatHome,
  head: () => ({
    meta: [
      { title: "Chats · Church Companion" },
      { name: "description", content: "Congregation and youth conversations, updates and shared photos in one calm inbox." },
      { property: "og:title", content: "Chats · Church Companion" },
      { property: "og:description", content: "Congregation and youth conversations, updates and shared photos in one calm inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type FilterKey = "all" | "unread" | "groups" | "favorites" | "archived";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "groups", label: "Groups" },
  { key: "favorites", label: "Favourites" },
  { key: "archived", label: "Archived" },
];

interface Row {
  channel: ChatChannel;
  title: string;
  subtitle: string;
  locked: boolean;
  initials: string;
}

function timeLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/** Media-aware one-line preview, WhatsApp style. */
function previewOf(m: ChatMessage | null | undefined) {
  if (!m) return null;
  if (m.media_url && !m.content) return { icon: ImageIcon, text: "Photo" };
  if (m.media_url) return { icon: ImageIcon, text: m.content ?? "Photo" };
  if (m.content?.startsWith("http")) return { icon: FileText, text: m.content };
  return { icon: null, text: m.content ?? "" };
}

function ChatHome() {
  const { t } = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<ChatChannel[]>([]);
  const [menu, setMenu] = useState(false);
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => onPrefsChange(() => setPrefsTick((n) => n + 1)), []);

  const youth = typeof window !== "undefined" ? getYouthIdentity() : null;

  const rows: Row[] = useMemo(
    () => [
      {
        channel: "congregation",
        title: `${t("chat.congregation")} / मण्डली चैट`,
        subtitle: t("chat.no_messages"),
        locked: false,
        initials: "MC",
      },
      {
        channel: "youth",
        title: `${t("chat.youth")} / युवा चैट`,
        subtitle: youth ? t("chat.no_messages") : t("chat.locked"),
        locked: !youth,
        initials: "YC",
      },
    ],
    [t, youth],
  );

  const prefsMap = useMemo(() => {
    void prefsTick;
    void allPrefs();
    return Object.fromEntries(rows.map((r) => [r.channel, getPrefs(r.channel)])) as Record<ChatChannel, ChatPrefs>;
  }, [rows, prefsTick]);

  const toggleSelect = useCallback((channel: ChatChannel) => {
    setSelected((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  }, []);

  const bulk = (key: keyof ChatPrefs) => {
    selected.forEach((c) => togglePref(c, key));
    setSelected([]);
  };

  return (
    <AppShell left={<BackButton to="/" />} title={selected.length ? `${selected.length} selected` : undefined}>
      {/* ---------- Header ---------- */}
      {selected.length === 0 ? (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pt-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--brand)_22%,transparent)] font-display text-sm font-bold brand-text">
              CC
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold leading-tight">Chats</h1>
              <p className="truncate text-[11px] text-muted-foreground">Church Companion messaging</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="Camera" onClick={() => navigate({ to: "/chat/$channel", params: { channel: "congregation" } })}>
              <Camera className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton label="AI assistant" onClick={() => setMenu(false)}>
              <Sparkles className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton label="More options" onClick={() => setMenu((m) => !m)}>
              <MoreVertical className="h-[18px] w-[18px]" />
            </IconButton>
          </div>
        </header>
      ) : (
        <header className="flex items-center justify-between gap-2 pt-4">
          <button onClick={() => setSelected([])} className="focus-ring rounded-full p-2 text-muted-foreground" aria-label="Clear selection">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1">
            <IconButton label="Pin" onClick={() => bulk("pinned")}><Pin className="h-[18px] w-[18px]" /></IconButton>
            <IconButton label="Mute" onClick={() => bulk("muted")}><BellOff className="h-[18px] w-[18px]" /></IconButton>
            <IconButton label="Favourite" onClick={() => bulk("favorite")}><Star className="h-[18px] w-[18px]" /></IconButton>
            <IconButton label="Archive" onClick={() => bulk("archived")}><Archive className="h-[18px] w-[18px]" /></IconButton>
          </div>
        </header>
      )}

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="glass-strong mt-2 overflow-hidden rounded-2xl border border-border/40 p-1 text-sm"
          >
            {["Mark all read", "Notification settings", "Storage & data"].map((label) => (
              <button key={label} onClick={() => setMenu(false)} className="tap-card block w-full rounded-xl px-3 py-2.5 text-left">
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Search ---------- */}
      <div className="mt-4 flex items-center gap-2 rounded-full bg-secondary/70 px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats and messages"
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" className="focus-ring rounded-full p-0.5 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ---------- Filter chips ---------- */}
      <div className="-mx-[var(--app-gutter)] mt-3 overflow-x-auto px-[var(--app-gutter)] pb-1 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "focus-ring shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200",
                  active ? "brand-bg text-white" : "glass-chip text-muted-foreground",
                )}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Conversations ---------- */}
      <ul className="mt-3 space-y-2 pb-4">
        {rows.map((row, i) => (
          <ChatRow
            key={row.channel}
            row={row}
            prefs={prefsMap[row.channel]}
            filter={filter}
            query={query}
            index={i}
            reduce={Boolean(reduce)}
            selectMode={selected.length > 0}
            selected={selected.includes(row.channel)}
            onToggleSelect={() => toggleSelect(row.channel)}
          />
        ))}
      </ul>
    </AppShell>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="focus-ring grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors duration-200 active:scale-95"
    >
      {children}
    </button>
  );
}

function ChatRow({
  row, prefs, filter, query, index, reduce, selectMode, selected, onToggleSelect,
}: {
  row: Row;
  prefs: ChatPrefs;
  filter: FilterKey;
  query: string;
  index: number;
  reduce: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);

  const q = useQuery({
    queryKey: ["chat-preview", row.channel, row.locked],
    refetchInterval: 20000,
    queryFn: async () => ({
      last: row.locked ? null : await lastMessage(row.channel),
      unread: row.locked ? 0 : await unreadCount(row.channel),
    }),
  });

  const last = q.data?.last ?? null;
  const unread = prefs.archived ? 0 : (q.data?.unread ?? 0);
  const preview = previewOf(last);

  // Filters + search
  const matchesQuery =
    !query.trim() ||
    row.title.toLowerCase().includes(query.toLowerCase()) ||
    (last?.content ?? "").toLowerCase().includes(query.toLowerCase());
  const matchesFilter =
    filter === "all" ? !prefs.archived
      : filter === "unread" ? unread > 0 && !prefs.archived
      : filter === "groups" ? !prefs.archived
      : filter === "favorites" ? prefs.favorite
      : prefs.archived;

  if (!matchesQuery || !matchesFilter) return null;

  const startPress = () => {
    pressTimer.current = window.setTimeout(() => onToggleSelect(), 450);
  };
  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const body = (
    <div
      className={cn(
        "tap-card relative flex items-center gap-3 rounded-2xl p-3.5",
        selected ? "bg-[color-mix(in_oklab,var(--brand)_20%,transparent)]" : "premium-card",
      )}
    >
      <div className="relative shrink-0">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] brand-text">
          {selected ? <Check className="h-5 w-5" /> : row.channel === "youth" ? <Users className="h-5 w-5" /> : <MessagesSquare className="h-5 w-5" />}
        </span>
        {!row.locked && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate font-semibold">{row.title}</p>
          {prefs.favorite && <Star className="h-3.5 w-3.5 shrink-0 brand-text" />}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {!row.locked && last && (
            <CheckCheck className="h-3.5 w-3.5 shrink-0 brand-text" aria-label="Read" />
          )}
          {preview?.icon && <preview.icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate font-hi">
            {row.locked ? row.subtitle : last ? `${last.sender_name}: ${preview?.text}` : row.subtitle}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("text-[10px]", unread > 0 ? "brand-text font-semibold" : "text-muted-foreground")}>
          {timeLabel(last?.created_at)}
        </span>
        <div className="flex items-center gap-1">
          {prefs.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" aria-label="Pinned" />}
          {prefs.muted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="Muted" />}
          {row.locked ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : unread > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full brand-bg px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {unread}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <motion.li
      layout
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : index * 0.05, duration: 0.25 }}
      className="relative overflow-hidden rounded-2xl"
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => { e.preventDefault(); onToggleSelect(); }}
    >
      {/* Swipe action backdrops */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-2xl px-5 text-xs font-medium">
        <span className={cn("flex items-center gap-1.5 brand-text transition-opacity", swipeHint === "right" ? "opacity-100" : "opacity-0")}>
          {prefs.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} {prefs.pinned ? "Unpin" : "Pin"}
        </span>
        <span className={cn("flex items-center gap-1.5 text-muted-foreground transition-opacity", swipeHint === "left" ? "opacity-100" : "opacity-0")}>
          <Archive className="h-4 w-4" /> {prefs.archived ? "Unarchive" : "Archive"}
        </span>
      </div>

      <motion.div
        drag={reduce ? false : "x"}
        dragConstraints={{ left: -96, right: 96 }}
        dragElastic={0.12}
        dragSnapToOrigin
        onDrag={(_, info) => setSwipeHint(info.offset.x > 24 ? "right" : info.offset.x < -24 ? "left" : null)}
        onDragEnd={(_, info) => {
          setSwipeHint(null);
          if (info.offset.x > 72) togglePref(row.channel, "pinned");
          else if (info.offset.x < -72) togglePref(row.channel, "archived");
        }}
        className="relative touch-pan-y"
      >
        {selectMode ? (
          <button type="button" onClick={onToggleSelect} className="block w-full text-left">
            {body}
          </button>
        ) : (
          <Link to="/chat/$channel" params={{ channel: row.channel }} className="block">
            {body}
          </Link>
        )}
      </motion.div>
    </motion.li>
  );
}

/** Kept for future voice-note previews in the row subtitle. */
export const VoicePreviewIcon = Mic;
/** Kept for future notification-state chips. */
export const NotifyIcon = Bell;
