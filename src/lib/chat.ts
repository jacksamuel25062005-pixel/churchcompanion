// Chat module — identity, data access and realtime helpers.
//
// Two rooms: Congregation (name + phone, open to all) and Youth (phone must be
// on the approved whitelist). Identity is a device-held `session_id` sent as the
// `x-chat-session` request header — never a client-supplied phone number.
//
// Realtime uses a Supabase channel per room:
//   • presence  → who is online
//   • broadcast `user_typing`   → typing indicator (no DB write)
//   • broadcast `new_message`   → instant fan-out of an inserted message

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getDB, type ChatCacheRow } from "@/offline/db";

export type ChatChannel = "congregation" | "youth";

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  sender_name: string;
  sender_ref: string;          // phone_number
  content: string | null;
  media_url: string | null;    // reserved; the new schema is text-only
  created_at: string;
  is_edited?: boolean;
}

export interface ChatIdentity {
  sessionId: string;
  name: string;
  phone: string;
}

export interface OnlineUser {
  phone: string;
  name: string;
}

const TABLES: Record<ChatChannel, string> = {
  congregation: "congregation_chat_messages",
  youth: "youth_chat_messages",
};

// ---------------- Identity (device-local) ----------------

const KEYS: Record<ChatChannel, string> = {
  congregation: "cc.chat.congregation.v2",
  youth: "cc.chat.youth.v2",
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function write(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function getIdentity(channel: ChatChannel): ChatIdentity | null {
  return read<ChatIdentity>(KEYS[channel]);
}
export function getCongregationIdentity() { return getIdentity("congregation"); }
export function getYouthIdentity() { return getIdentity("youth"); }
export function clearIdentity(channel: ChatChannel) {
  try { window.localStorage.removeItem(KEYS[channel]); } catch { /* ignore */ }
}
export function clearYouthIdentity() { clearIdentity("youth"); }

export function senderFor(channel: ChatChannel): { ref: string; name: string } | null {
  const id = getIdentity(channel);
  return id ? { ref: id.phone, name: id.name } : null;
}

type JoinRow = { session_id: string; name: string; phone_number: string };

/** Congregation entry: name + phone, one time, session persists forever. */
export async function joinCongregation(name: string, phone: string): Promise<ChatIdentity> {
  const { data, error } = await supabase.rpc("congregation_join" as never, {
    _name: name.trim(), _phone: phone.trim(),
  } as never);
  if (error) throw error;
  const row = (data as unknown as JoinRow[])?.[0];
  if (!row) throw new Error("Could not join the chat");
  const identity: ChatIdentity = { sessionId: row.session_id, name: row.name, phone: row.phone_number };
  write(KEYS.congregation, identity);
  return identity;
}

/** Youth entry: phone must be on the approved whitelist. Null = not approved. */
export async function joinYouth(phone: string): Promise<ChatIdentity | null> {
  const { data, error } = await supabase.rpc("youth_join" as never, { _phone: phone.trim() } as never);
  if (error) throw error;
  const row = (data as unknown as JoinRow[])?.[0];
  if (!row) return null;
  const identity: ChatIdentity = { sessionId: row.session_id, name: row.name, phone: row.phone_number };
  write(KEYS.youth, identity);
  return identity;
}

/** Re-validate a stored session; keeps it when offline, clears it when revoked. */
export async function refreshSession(channel: ChatChannel): Promise<ChatIdentity | null> {
  const current = getIdentity(channel);
  if (!current) return null;
  try {
    const { data, error } = await supabase.rpc("chat_session_info" as never, {
      _chat: channel, _session: current.sessionId,
    } as never);
    if (error) return current;
    const row = (data as unknown as Array<{ name: string; phone_number: string }>)?.[0];
    if (!row) { clearIdentity(channel); return null; }
    const next: ChatIdentity = { ...current, name: row.name, phone: row.phone_number };
    write(KEYS[channel], next);
    return next;
  } catch { return current; }
}
export const refreshYouthSession = () => refreshSession("youth");

// ---------------- Access requests ----------------

export type RequestStatus = "pending" | "approved" | "rejected";

export async function requestYouthAccess(name: string, phone: string, message?: string) {
  const { data, error } = await supabase.rpc("youth_request_access" as never, {
    _name: name.trim(), _phone: phone.trim(), _message: message?.trim() || null,
  } as never);
  if (error) throw error;
  return data as unknown as string; // 'pending' | 'already_approved'
}

export async function youthRequestStatus(phone: string): Promise<
  { status: RequestStatus; rejection_reason: string | null; created_at: string } | null
> {
  const { data, error } = await supabase.rpc("youth_request_status" as never, { _phone: phone.trim() } as never);
  if (error) return null;
  const row = (data as unknown as Array<{ status: RequestStatus; rejection_reason: string | null; created_at: string }>)?.[0];
  return row ?? null;
}

// ---------------- Session-scoped client ----------------

const _clients = new Map<string, SupabaseClient>();

function sessionClient(sessionId: string): SupabaseClient {
  const existing = _clients.get(sessionId);
  if (existing) return existing;
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { "x-chat-session": sessionId },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", key);
        headers.set("x-chat-session", sessionId);
        return fetch(input, { ...init, headers });
      },
    },
  });
  _clients.set(sessionId, client);
  return client;
}

export function clientFor(channel: ChatChannel): SupabaseClient {
  const id = getIdentity(channel);
  if (!id) throw new Error("No chat session");
  return sessionClient(id.sessionId);
}

// ---------------- Offline message cache (Dexie) ----------------

function toRow(channel: ChatChannel, m: ChatMessage): ChatCacheRow {
  return {
    id: m.id, channel, sender_name: m.sender_name, sender_ref: m.sender_ref,
    content: m.content, created_at: m.created_at,
  };
}
function fromRow(r: ChatCacheRow): ChatMessage {
  return {
    id: r.id, channel: r.channel, sender_name: r.sender_name, sender_ref: r.sender_ref,
    content: r.content, media_url: null, created_at: r.created_at,
  };
}

export async function cacheMessages(channel: ChatChannel, messages: ChatMessage[]) {
  try { await getDB().chat_cache.bulkPut(messages.map((m) => toRow(channel, m))); } catch { /* ignore */ }
}

/** Drop a single cached message so deletions don't resurrect from the offline cache. */
export async function uncacheMessage(id: string) {
  try { await getDB().chat_cache.delete(id); } catch { /* ignore */ }
}

/**
 * Reconcile the offline cache with an authoritative newest page from the
 * server: any cached row newer-or-equal to the oldest server row that the
 * server no longer has was deleted elsewhere and must go.
 */
async function reconcileCache(channel: ChatChannel, serverRows: ChatMessage[]) {
  try {
    const db = getDB();
    const rows = await db.chat_cache.where("channel").equals(channel).toArray();
    if (!rows.length) return;
    const keep = new Set(serverRows.map((m) => m.id));
    const oldest = serverRows.length ? serverRows[0].created_at : null;
    const stale = rows
      .filter((r) => !keep.has(r.id) && (oldest === null || r.created_at >= oldest))
      .map((r) => r.id);
    if (stale.length) await db.chat_cache.bulkDelete(stale);
  } catch { /* ignore */ }
}

export async function cachedMessages(channel: ChatChannel, limit = 100): Promise<ChatMessage[]> {
  try {
    const rows = await getDB().chat_cache.where("channel").equals(channel).sortBy("created_at");
    return rows.slice(-limit).map(fromRow);
  } catch { return []; }
}


// ---------------- Data access ----------------

type DbRow = {
  id: string; phone_number: string; sender_name: string; message_content: string;
  created_at: string; is_edited: boolean;
};

function mapRow(channel: ChatChannel, r: DbRow): ChatMessage {
  return {
    id: r.id, channel, sender_name: r.sender_name, sender_ref: r.phone_number,
    content: r.message_content, media_url: null, created_at: r.created_at, is_edited: r.is_edited,
  };
}

export const PAGE_SIZE = 40;

/**
 * Newest-last page of messages. `before` loads the previous page (infinite
 * scroll upwards). Results are cached in Dexie for offline reads.
 */
export async function listMessages(
  channel: ChatChannel,
  opts: { before?: string; limit?: number } = {},
): Promise<ChatMessage[]> {
  const limit = opts.limit ?? PAGE_SIZE;
  try {
    const db = clientFor(channel);
    let q = db.from(TABLES[channel]).select("*").order("created_at", { ascending: false }).limit(limit);
    if (opts.before) q = q.lt("created_at", opts.before);
    const { data, error } = await q;
    if (error) throw error;
    const rows = ((data ?? []) as DbRow[]).map((r) => mapRow(channel, r)).reverse();
    void cacheMessages(channel, rows);
    if (!opts.before) void reconcileCache(channel, rows);
    return rows;

  } catch (err) {
    if (!opts.before) {
      const cached = await cachedMessages(channel, limit);
      if (cached.length) return cached;
    }
    throw err;
  }
}

export async function lastMessage(channel: ChatChannel): Promise<ChatMessage | null> {
  try {
    const db = clientFor(channel);
    const { data } = await db.from(TABLES[channel]).select("*")
      .order("created_at", { ascending: false }).limit(1);
    const row = ((data ?? []) as DbRow[])[0];
    return row ? mapRow(channel, row) : null;
  } catch {
    const cached = await cachedMessages(channel, 1);
    return cached[0] ?? null;
  }
}

/** Send through the rate-limited server function; identity comes from the header. */
export async function sendMessage(
  channel: ChatChannel,
  payload: { content?: string | null; media_url?: string | null },
): Promise<ChatMessage> {
  const sender = senderFor(channel);
  if (!sender) throw new Error("No identity");
  const text = (payload.content ?? "").trim();
  if (!text) throw new Error("Empty message");
  const db = clientFor(channel);
  const { data, error } = await db.rpc("chat_send", { _chat: channel, _content: text });
  if (error) throw error;
  const message: ChatMessage = {
    id: data as unknown as string,
    channel,
    sender_name: sender.name,
    sender_ref: sender.ref,
    content: text,
    media_url: null,
    created_at: new Date().toISOString(),
  };
  void cacheMessages(channel, [message]);
  return message;
}

export async function heartbeat(channel: ChatChannel) {
  try { await clientFor(channel).rpc("chat_heartbeat", { _chat: channel }); } catch { /* ignore */ }
}

// ---------------- Message actions (edit / delete / react) ----------------

export interface ChatReaction {
  id: string;
  message_id: string;
  sender_ref: string;
  sender_name: string;
  emoji: string;
}

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "🎉"] as const;

/** Edit a message. Sender uses their chat session; a super admin uses their login. */
export async function editMessage(channel: ChatChannel, id: string, content: string) {
  const args = { _chat: channel, _id: id, _content: content.trim() };
  let db;
  try { db = clientFor(channel); } catch { db = supabase; }
  const { error } = await (db as SupabaseClient).rpc("chat_edit_message", args);
  if (error) {
    // Fall back to the signed-in (super admin) client.
    const { error: e2 } = await supabase.rpc("chat_edit_message" as never, args as never);
    if (e2) throw e2;
  }
}

/** Delete a message — super admin only (enforced in the database). */
export async function deleteMessage(channel: ChatChannel, id: string) {
  const { error } = await supabase.rpc("chat_delete_message" as never, { _chat: channel, _id: id } as never);
  if (error) throw error;
  await uncacheMessage(id);
}


/** Toggle an emoji reaction for the current chat session. */
export async function toggleReaction(channel: ChatChannel, messageId: string, emoji: string) {
  const db = clientFor(channel);
  const { data, error } = await db.rpc("chat_react", { _chat: channel, _message_id: messageId, _emoji: emoji });
  if (error) throw error;
  return data as unknown as "added" | "removed";
}

export async function listReactions(channel: ChatChannel, messageIds: string[]): Promise<ChatReaction[]> {
  if (!messageIds.length) return [];
  try {
    const db = clientFor(channel);
    const { data, error } = await db
      .from("chat_message_reactions")
      .select("id, message_id, sender_ref, sender_name, emoji")
      .eq("chat", channel)
      .in("message_id", messageIds);
    if (error) throw error;
    return (data ?? []) as ChatReaction[];
  } catch { return []; }
}

// ---------------- Read receipts (WhatsApp-style ticks) ----------------

export type ReceiptStatus = "pending" | "sent" | "delivered" | "read";

export interface ReceiptState {
  delivered: number;
  read: number;
  audience: number;
}

/** Record that the current member received (and optionally read) messages. */
export async function markReceipts(channel: ChatChannel, ids: string[], read: boolean) {
  if (!ids.length) return;
  try {
    const db = clientFor(channel);
    await db.rpc("chat_mark_receipts", { _chat: channel, _ids: ids, _read: read });
  } catch { /* offline — receipts catch up on the next sync */ }
}

/** Receipt counts for the caller's own messages, keyed by message id. */
export async function receiptState(
  channel: ChatChannel,
  ids: string[],
): Promise<Record<string, ReceiptState>> {
  if (!ids.length) return {};
  try {
    const db = clientFor(channel);
    const { data, error } = await db.rpc("chat_receipt_state", { _chat: channel, _ids: ids });
    if (error) throw error;
    const out: Record<string, ReceiptState> = {};
    for (const r of (data ?? []) as Array<{
      message_id: string; delivered_count: number; read_count: number; audience: number;
    }>) {
      out[r.message_id] = { delivered: r.delivered_count, read: r.read_count, audience: r.audience };
    }
    return out;
  } catch { return {}; }
}

/** Map counts to a tick state: everyone must receive / read it, like WhatsApp groups. */
export function statusFor(state: ReceiptState | undefined): ReceiptStatus {
  if (!state || state.audience === 0) return "sent";
  if (state.read >= state.audience) return "read";
  if (state.delivered >= state.audience) return "delivered";
  return "sent";
}

// ---------------- Congregation member admin (super admin) ----------------

export interface CongregationMember {
  phone_number: string;
  name: string;
  is_online: boolean;
  last_seen: string;
  joined_at: string;
  message_count: number;
}

export async function listCongregationMembers(): Promise<CongregationMember[]> {
  const { data, error } = await supabase.rpc("congregation_admin_users" as never);
  if (error) throw error;
  return (data ?? []) as unknown as CongregationMember[];
}

export async function updateCongregationMember(phone: string, name: string) {
  const { error } = await supabase.rpc("congregation_admin_update_user" as never, {
    _phone: phone, _name: name.trim(),
  } as never);
  if (error) throw error;
}

export async function removeCongregationMember(phone: string) {
  const { error } = await supabase.rpc("congregation_admin_remove_user" as never, { _phone: phone } as never);
  if (error) throw error;
}


// ---------------- Unread tracking (device-local) ----------------

const SEEN_KEY = "cc.chat.lastSeen";

export function getLastSeen(): Record<string, string> {
  return read<Record<string, string>>(SEEN_KEY) ?? {};
}
export function setLastSeen(channel: ChatChannel, iso: string) {
  write(SEEN_KEY, { ...getLastSeen(), [channel]: iso });
}

export async function unreadCount(channel: ChatChannel): Promise<number> {
  try {
    const since = getLastSeen()[channel];
    const db = clientFor(channel);
    let q = db.from(TABLES[channel]).select("id", { count: "exact", head: true });
    if (since) q = q.gt("created_at", since);
    const { count } = await q;
    return count ?? 0;
  } catch { return 0; }
}

// ---------------- Realtime ----------------

export function roomName(channel: ChatChannel) {
  return `chat-room:${channel}`;
}
export const presenceChannelName = roomName;

export interface TypingPayload {
  chat_type: ChatChannel;
  phone_number: string;
  sender_name: string;
  is_typing: boolean;
}

export interface RoomHandlers {
  onMessage?: (m: ChatMessage) => void;
  onTyping?: (p: TypingPayload) => void;
  onPresence?: (users: OnlineUser[]) => void;
  onEdited?: (p: { id: string; content: string }) => void;
  onDeleted?: (p: { id: string }) => void;
  onReaction?: () => void;
}

/**
 * Join a chat room: tracks presence, relays typing pings and broadcast message
 * fan-out. Returns helpers plus an unsubscribe function.
 */
export function joinRoom(channel: ChatChannel, handlers: RoomHandlers) {
  const me = senderFor(channel);
  const ch = supabase.channel(roomName(channel), {
    config: { presence: { key: me?.ref ?? `guest-${Math.random().toString(36).slice(2)}` } },
  });

  ch.on("broadcast", { event: "new_message" }, ({ payload }) => {
    handlers.onMessage?.(payload as ChatMessage);
  });
  ch.on("broadcast", { event: "message_edited" }, ({ payload }) => {
    handlers.onEdited?.(payload as { id: string; content: string });
  });
  ch.on("broadcast", { event: "message_deleted" }, ({ payload }) => {
    handlers.onDeleted?.(payload as { id: string });
  });
  ch.on("broadcast", { event: "reaction" }, () => {
    handlers.onReaction?.();
  });
  ch.on("broadcast", { event: "user_typing" }, ({ payload }) => {
    handlers.onTyping?.(payload as TypingPayload);
  });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<{ phone: string; name: string }>();
    const users: OnlineUser[] = [];
    for (const list of Object.values(state)) {
      const entry = list[0];
      if (entry?.phone) users.push({ phone: entry.phone, name: entry.name });
    }
    handlers.onPresence?.(users);
  });

  void ch.subscribe((status) => {
    if (status === "SUBSCRIBED" && me) {
      void ch.track({ phone: me.ref, name: me.name });
    }
  });

  return {
    broadcastMessage: (m: ChatMessage) => {
      void ch.send({ type: "broadcast", event: "new_message", payload: m });
    },
    broadcastEdit: (id: string, content: string) => {
      void ch.send({ type: "broadcast", event: "message_edited", payload: { id, content } });
    },
    broadcastDelete: (id: string) => {
      void ch.send({ type: "broadcast", event: "message_deleted", payload: { id } });
    },
    broadcastReaction: () => {
      void ch.send({ type: "broadcast", event: "reaction", payload: {} });
    },
    sendTyping: (isTyping: boolean) => {
      if (!me) return;
      void ch.send({
        type: "broadcast",
        event: "user_typing",
        payload: { chat_type: channel, phone_number: me.ref, sender_name: me.name, is_typing: isTyping },
      });
    },
    leave: () => { void supabase.removeChannel(ch); },
  };
}


// ---------------- Approved-youth roster sync ----------------
//
// The whitelist is admin-only, so clients cannot subscribe to the table.
// Admins broadcast a lightweight "changed" ping and every device retries.

const ROSTER_CHANNEL = "youth-roster";

export function broadcastYouthRoster() {
  const ch = supabase.channel(ROSTER_CHANNEL);
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void ch.send({ type: "broadcast", event: "changed", payload: {} }).then(() => {
      void supabase.removeChannel(ch);
    });
  });
}

export function onYouthRosterChange(cb: () => void) {
  const ch = supabase
    .channel(ROSTER_CHANNEL)
    .on("broadcast", { event: "changed" }, () => cb())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}
