// Helpers for queueing mutations into the outbox. The sync engine will drain
// these against Supabase. Each enqueue also writes the optimistic row into
// the local Dexie table so reads stay instant.

import { getDB, type OutboxOp, type SyncTable } from "./db";
import { runSync } from "./sync/engine";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface EnqueueOpts {
  table: SyncTable;
  op: OutboxOp;
  row_id: string;
  payload: Record<string, unknown> | null;
}

export async function enqueueOutbox(opts: EnqueueOpts): Promise<string> {
  const db = getDB();
  const id = uuid();
  const now = Date.now();
  await db.outbox.put({
    id,
    table: opts.table,
    op: opts.op,
    row_id: opts.row_id,
    payload: opts.payload,
    created_at: now,
    attempts: 0,
    next_attempt_at: now,
    status: "pending",
  });

  // Optimistic local apply
  try {
    const table = db.table(opts.table);
    if (opts.op === "delete") {
      await table.delete(opts.row_id);
    } else if (opts.payload) {
      await table.put({ ...opts.payload, updated_at: new Date(now).toISOString() });
    }
  } catch { /* local apply best-effort */ }

  // Kick the engine; non-blocking.
  void runSync();
  return id;
}
