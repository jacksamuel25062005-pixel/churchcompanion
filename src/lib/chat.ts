// Chat module — identity, data access and realtime helpers.
//
// Chat is the one module that requires a live connection: it is deliberately
// NOT part of the offline-first sync engine. Failed sends are queued in Dexie
// and retried on reconnect.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type ChatChannel = "congregation" | "youth";

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  sender_name: string;
  sender_ref: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  deleted: boolean;
  reply_to?: string | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  sender_ref: string;
  emoji: string;
}

export const REACTION_EMOJIS = ["🙏", "❤️", "🙌", "😊", "🕊️", "👍"];

// ---------------- Identity (device-local) ----------------

const CONG_KEY = "cc.chat.congregation";
const YOUTH_KEY = "cc.chat.youth";

export interface CongregationIdentity { sessionId: string; name: string }
export interface YouthIdentity { token: string; youthId: string; name: string }

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

export function getCongregationIdentity() { return read<CongregationIdentity>(CONG_KEY); }
export function getYouthIdentity() { return read<YouthIdentity>(YOUTH_KEY); }
export function clearYouthIdentity() {
  try { window.localStorage.removeItem(YOUTH_KEY); } catch { /* ignore */ }
}

export async function registerCongregation(name: string, email: string, phone: string): Promise<CongregationIdentity> {
  const { data, error } = await supabase.rpc("congregation_register", {
    _name: name.trim(), _email: email.trim(), _phone: phone.trim(),
  });
  if (error) throw error;
  const identity: CongregationIdentity = { sessionId: data as unknown as string, name: name.trim() };
  write(CONG_KEY, identity);
  return identity;
}

/** Phone-gate for youth chat. Returns null when the number is not approved. */
export async function checkYouthPhone(phone: string): Promise<YouthIdentity | null> {
  const { data, error } = await supabase.rpc("youth_check_phone", { _phone: phone.trim() });
  if (error) throw error;
  const row = (data as unknown as Array<{ token: string; name: string; youth_id: string }>)?.[0];
  if (!row) return null;
  const identity: YouthIdentity = { token: row.token, youthId: row.youth_id, name: row.name };
  write(YOUTH_KEY, identity);
  return identity;
}

/**
 * Keeps a saved youth session alive so an approved member is never asked for
 * their number again. Returns null only when the session is truly revoked.
 */
export async function refreshYouthSession(): Promise<YouthIdentity | null> {
  const current = getYouthIdentity();
  if (!current) return null;
  try {
    const { data, error } = await supabase.rpc("youth_refresh_session" as never, { _token: current.token } as never);
    if (error) return current; // offline / transient — keep the device session
    const row = (data as unknown as Array<{ token: string; name: string; youth_id: string }>)?.[0];
    if (!row) { clearYouthIdentity(); return null; }
    const identity: YouthIdentity = { token: row.token, youthId: row.youth_id, name: row.name };
    write(YOUTH_KEY, identity);
    return identity;
  } catch {
    return current;
  }
}


// ---------------- Clients ----------------

const _tokenClients = new Map<string, SupabaseClient>();

/**
 * Channel identity is proven with a device-held token sent as a request header
 * (`x-youth-token` / `x-congregation-token`) — never a raw client-supplied
 * sender_ref, which anyone could guess.
 */
function tokenClient(header: string, token: string): SupabaseClient {
  const cacheKey = `${header}:${token}`;
  const existing = _tokenClients.get(cacheKey);
  if (existing) return existing;
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { [header]: token },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", key);
        headers.set(header, token);
        return fetch(input, { ...init, headers });
      },
    },
  });
  _tokenClients.set(cacheKey, client);
  return client;
}

export function clientFor(channel: ChatChannel): SupabaseClient {
  if (channel === "youth") {
    const y = getYouthIdentity();
    if (!y) throw new Error("Youth access required");
    return tokenClient("x-youth-token", y.token);
  }
  const c = getCongregationIdentity();
  if (c) return tokenClient("x-congregation-token", c.sessionId);
  return supabase as unknown as SupabaseClient;
}

export function senderFor(channel: ChatChannel): { ref: string; name: string } | null {
  if (channel === "youth") {
    const y = getYouthIdentity();
    return y ? { ref: y.youthId, name: y.name } : null;
  }
  const c = getCongregationIdentity();
  return c ? { ref: c.sessionId, name: c.name } : null;
}

// ---------------- Data access ----------------

export async function listMessages(channel: ChatChannel, limit = 200): Promise<ChatMessage[]> {
  const db = clientFor(channel);
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .eq("channel", channel)
    .eq("deleted", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function lastMessage(channel: ChatChannel): Promise<ChatMessage | null> {
  try {
    const db = clientFor(channel);
    const { data } = await db
      .from("chat_messages")
      .select("*")
      .eq("channel", channel)
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(1);
    return ((data ?? [])[0] as ChatMessage) ?? null;
  } catch { return null; }
}

export async function sendMessage(
  channel: ChatChannel,
  payload: { content?: string | null; media_url?: string | null; reply_to?: string | null },
): Promise<ChatMessage> {
  const sender = senderFor(channel);
  if (!sender) throw new Error("No identity");
  const db = clientFor(channel);
  const { data, error } = await db
    .from("chat_messages")
    .insert({
      channel,
      sender_name: sender.name,
      sender_ref: sender.ref,
      content: payload.content ?? null,
      media_url: payload.media_url ?? null,
      reply_to: payload.reply_to ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function listReactions(channel: ChatChannel, messageIds: string[]): Promise<Reaction[]> {
  if (!messageIds.length) return [];
  const db = clientFor(channel);
  const { data, error } = await db.from("message_reactions").select("*").in("message_id", messageIds);
  if (error) throw error;
  return (data ?? []) as Reaction[];
}

export async function toggleReaction(channel: ChatChannel, messageId: string, emoji: string) {
  const sender = senderFor(channel);
  if (!sender) return;
  const db = clientFor(channel);
  const { data } = await db
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("sender_ref", sender.ref)
    .eq("emoji", emoji)
    .maybeSingle();
  if (data?.id) {
    await db.from("message_reactions").delete().eq("id", data.id);
  } else {
    await db.from("message_reactions").insert({ message_id: messageId, sender_ref: sender.ref, emoji });
  }
}

export async function markRead(channel: ChatChannel, messages: ChatMessage[]) {
  const sender = senderFor(channel);
  if (!sender) return;
  const rows = messages
    .filter((m) => m.sender_ref !== sender.ref)
    .map((m) => ({ message_id: m.id, reader_ref: sender.ref }));
  if (!rows.length) return;
  const db = clientFor(channel);
  await db.from("message_receipts").upsert(rows, { onConflict: "message_id,reader_ref", ignoreDuplicates: true });
}

export async function readCounts(channel: ChatChannel, messageIds: string[]): Promise<Record<string, number>> {
  if (!messageIds.length) return {};
  const db = clientFor(channel);
  const { data } = await db.from("message_receipts").select("message_id").in("message_id", messageIds);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { message_id: string }[]) out[r.message_id] = (out[r.message_id] ?? 0) + 1;
  return out;
}

export async function reportMessage(channel: ChatChannel, messageId: string, reason: string) {
  const sender = senderFor(channel);
  const db = clientFor(channel);
  await db.from("chat_reports").insert({
    message_id: messageId,
    reporter_ref: sender?.ref ?? "anonymous",
    reason,
  });
}

export async function uploadChatImage(channel: ChatChannel, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${channel}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const db = clientFor(channel);
  const { error } = await db.storage.from("chat-media").upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}

export async function signChatMedia(channel: ChatChannel, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const db = clientFor(channel);
  const { data } = await db.storage.from("chat-media").createSignedUrls(paths, 60 * 60 * 6);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
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
    let q = db
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel", channel)
      .eq("deleted", false);
    if (since) q = q.gt("created_at", since);
    const { count } = await q;
    return count ?? 0;
  } catch { return 0; }
}

// ---------------- Realtime helpers ----------------

export function presenceChannelName(channel: ChatChannel) {
  return `chat-room:${channel}`;
}

// ---------------- Approved-youth roster sync ----------------
//
// The roster itself is admin-only, so clients cannot subscribe to the table.
// Instead admins broadcast a lightweight "changed" ping on a realtime channel
// and every device re-validates its own youth session immediately.

const ROSTER_CHANNEL = "youth-roster";

/** Tell every connected device that the approved youth list changed. */
export function broadcastYouthRoster() {
  const ch = supabase.channel(ROSTER_CHANNEL);
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void ch.send({ type: "broadcast", event: "changed", payload: {} }).then(() => {
      void supabase.removeChannel(ch);
    });
  });
}

/** Listen for roster changes. Returns an unsubscribe function. */
export function onYouthRosterChange(cb: () => void) {
  const ch = supabase
    .channel(ROSTER_CHANNEL)
    .on("broadcast", { event: "changed" }, () => cb())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}
