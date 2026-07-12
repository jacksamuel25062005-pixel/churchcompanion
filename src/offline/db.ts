// Local-first IndexedDB schema (Dexie).
//
// All app-syncable rows live here. Reads can hydrate instantly from these
// tables; writes get queued into `outbox` and `uploads`. The sync engine in
// ./sync drains outbox + pulls server deltas via the `sync_pull` RPC.

import Dexie, { type EntityTable } from "dexie";
import type { Book, BookSection, Song, TodaySet } from "../lib/types";

export type SyncTable =
  | "songs"
  | "book_sections"
  | "today_song_sets"
  | "today_song_items"
  | "books";

export type OutboxOp = "upsert" | "delete";

export interface BookRow extends Book {
  updated_at?: string;
  is_deleted?: boolean;
}
export interface SongRow extends Song {
  updated_at?: string;
  is_deleted?: boolean;
}
export interface BookSectionRow extends BookSection {
  updated_at?: string;
  is_deleted?: boolean;
}
export interface TodaySetRow extends TodaySet {
  updated_at?: string;
  is_deleted?: boolean;
}
export interface TodayItemRow {
  id: string;
  set_id: string;
  song_id: string;
  position: number;
  updated_at?: string;
  is_deleted?: boolean;
}

export interface OutboxRow {
  id: string;                 // uuid (idempotency key)
  table: SyncTable;
  op: OutboxOp;
  row_id: string;             // PK of target row
  payload: Record<string, unknown> | null;
  created_at: number;
  attempts: number;
  next_attempt_at: number;
  last_error?: string;
  status: "pending" | "in-flight" | "done" | "failed";
}

export type UploadStatus =
  | "queued"
  | "in-flight"
  | "completed"
  | "failed"
  | "paused";

export interface UploadRow {
  id: string;                 // job uuid
  kind: string;               // 'admin-import' | 'storage' | ...
  filename: string;
  mime: string;
  size: number;
  blob: Blob;
  bucket?: string;            // optional supabase storage bucket
  path?: string;              // optional storage path
  meta?: Record<string, unknown>;
  status: UploadStatus;
  progress: number;           // 0..1
  retries: number;
  last_error?: string;
  created_at: number;
  updated_at: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
  updated_at: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
  updated_at: number;
}

export interface CachedImageRow {
  url: string;      // primary key — normalized URL (no query for signed URLs)
  cached_at: number;
  size: number;     // bytes; 0 if unknown
  source?: string;  // 'book-pages' | 'storage' | 'remote' | ...
}

export class ChurchDB extends Dexie {
  books!: EntityTable<BookRow, "id">;
  songs!: EntityTable<SongRow, "id">;
  book_sections!: EntityTable<BookSectionRow, "id">;
  today_song_sets!: EntityTable<TodaySetRow, "id">;
  today_song_items!: EntityTable<TodayItemRow, "id">;
  outbox!: EntityTable<OutboxRow, "id">;
  uploads!: EntityTable<UploadRow, "id">;
  meta!: EntityTable<MetaRow, "key">;
  cached_images!: EntityTable<CachedImageRow, "url">;

  constructor() {
    super("church-companion");
    this.version(1).stores({
      books: "id, slug, sort_order, updated_at",
      songs: "id, number, updated_at, is_deleted",
      book_sections: "id, book_id, number, sort_order, updated_at, is_deleted",
      today_song_sets: "id, for_date, updated_at, is_deleted",
      today_song_items: "id, set_id, position, updated_at, is_deleted",
      outbox: "id, status, next_attempt_at, created_at, table",
      uploads: "id, status, created_at, updated_at",
      meta: "key",
    });
    this.version(2).stores({
      cached_images: "url, cached_at, source",
    });
  }
}

let _db: ChurchDB | null = null;
export function getDB(): ChurchDB {
  if (typeof window === "undefined") {
    // Dexie needs indexedDB; return a proxy that throws on use during SSR.
    throw new Error("ChurchDB is browser-only");
  }
  if (!_db) _db = new ChurchDB();
  return _db;
}

// ---------------- Meta helpers ----------------

export async function metaGet<T = unknown>(key: string): Promise<T | undefined> {
  const row = await getDB().meta.get(key);
  return row?.value as T | undefined;
}
export async function metaSet(key: string, value: unknown): Promise<void> {
  await getDB().meta.put({ key, value, updated_at: Date.now() });
}

export const META_KEYS = {
  lastSyncedAt: "sync.lastSyncedAt", // ISO timestamptz from server_time
  lastSyncRunAt: "sync.lastRunAt",   // local ms
  lastSyncError: "sync.lastError",
} as const;
