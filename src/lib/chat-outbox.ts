// Failed chat sends are parked in Dexie and retried when connectivity returns.
import { getDB, type ChatOutboxRow } from "@/offline/db";
import { sendMessage, type ChatChannel } from "./chat";

export async function queueMessage(channel: ChatChannel, content: string | null, media_url: string | null) {
  const row: ChatOutboxRow = {
    id: crypto.randomUUID(),
    channel,
    content,
    media_url,
    created_at: Date.now(),
  };
  await getDB().chat_outbox.put(row);
  return row;
}

export async function pendingMessages(channel: ChatChannel): Promise<ChatOutboxRow[]> {
  try {
    return await getDB().chat_outbox.where("channel").equals(channel).sortBy("created_at");
  } catch { return []; }
}

/** Drain queued sends. Returns how many were delivered. */
export async function flushChatOutbox(channel: ChatChannel): Promise<number> {
  const rows = await pendingMessages(channel);
  let sent = 0;
  for (const row of rows) {
    try {
      await sendMessage(channel, { content: row.content, media_url: row.media_url });
      await getDB().chat_outbox.delete(row.id);
      sent++;
    } catch {
      break; // still offline / still failing — keep order
    }
  }
  return sent;
}
