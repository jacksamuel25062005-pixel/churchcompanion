// Offline content snapshots: persist books / songs / today's set in
// localStorage so users can read without a network connection.

import type { Book, BookSection, Song, TodaySet } from "./types";

const PREFIX = "cc.offline.";
const INDEX_KEY = `${PREFIX}index`;

export type OfflineKind = "song-book" | "book" | "today";

export interface OfflineEntry {
  key: string; // storage key
  kind: OfflineKind;
  slug: string; // "song-book", book slug, or "today"
  label: string;
  count: number; // songs or sections
  bytes: number;
  at: number;
}

export interface SongBookSnap {
  book: Book;
  songs: Song[];
  at: number;
}
export interface BookSnap {
  book: Book;
  sections: BookSection[];
  at: number;
}
export interface TodaySnap {
  set: Pick<TodaySet, "id" | "for_date" | "title" | "note"> | null;
  items: Song[];
  at: number;
  for_date: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): number {
  if (typeof window === "undefined") return 0;
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
  } catch (e) {
    throw new Error("Storage full. Remove other downloads and try again.");
  }
  try {
    window.dispatchEvent(new CustomEvent("cc:offline"));
  } catch {}
  return raw.length;
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cc:offline"));
  } catch {}
}

function readIndex(): Record<string, OfflineEntry> {
  return read<Record<string, OfflineEntry>>(INDEX_KEY, {});
}
function writeIndex(idx: Record<string, OfflineEntry>) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cc:offline"));
  } catch {}
}

function setIndex(entry: OfflineEntry) {
  const idx = readIndex();
  idx[entry.key] = entry;
  writeIndex(idx);
}
function unsetIndex(key: string) {
  const idx = readIndex();
  delete idx[key];
  writeIndex(idx);
}

// ----- Song Book ----------------------------------------------------------

const songBookKey = () => `${PREFIX}song-book`;

export function saveSongBook(snap: SongBookSnap) {
  const bytes = write(songBookKey(), snap);
  setIndex({
    key: songBookKey(),
    kind: "song-book",
    slug: "song-book",
    label: snap.book.title_en || snap.book.title_hi || "Song Book",
    count: snap.songs.length,
    bytes,
    at: snap.at,
  });
}
export function getSongBookSnap(): SongBookSnap | null {
  return read<SongBookSnap | null>(songBookKey(), null);
}
export function getCachedSong(id: string): Song | null {
  const snap = getSongBookSnap();
  return snap?.songs.find((s) => s.id === id) ?? null;
}

// ----- Generic Book (sections) -------------------------------------------

const bookKey = (slug: string) => `${PREFIX}book.${slug}`;

export function saveBook(slug: string, snap: BookSnap) {
  const bytes = write(bookKey(slug), snap);
  setIndex({
    key: bookKey(slug),
    kind: "book",
    slug,
    label: snap.book.title_en || snap.book.title_hi || slug,
    count: snap.sections.length,
    bytes,
    at: snap.at,
  });
}
export function getBookSnap(slug: string): BookSnap | null {
  return read<BookSnap | null>(bookKey(slug), null);
}

// ----- Today --------------------------------------------------------------

const todayKey = () => `${PREFIX}today`;

export function saveToday(snap: TodaySnap) {
  const bytes = write(todayKey(), snap);
  setIndex({
    key: todayKey(),
    kind: "today",
    slug: "today",
    label: snap.set?.title || "Today's Songs",
    count: snap.items.length,
    bytes,
    at: snap.at,
  });
}
export function getTodaySnap(): TodaySnap | null {
  return read<TodaySnap | null>(todayKey(), null);
}

// ----- Removal & listing --------------------------------------------------

export function removeOffline(key: string) {
  remove(key);
  unsetIndex(key);
}
export function listOffline(): OfflineEntry[] {
  return Object.values(readIndex()).sort((a, b) => b.at - a.at);
}
export function isDownloaded(key: string): boolean {
  return !!readIndex()[key];
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// React hook to subscribe to offline changes.
import { useEffect, useState } from "react";

export function useOfflineIndex() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick((x) => x + 1);
    window.addEventListener("cc:offline", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("cc:offline", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  // tick used only to trigger re-render
  void tick;
  return listOffline();
}

export function useIsDownloaded(key: string) {
  const list = useOfflineIndex();
  return list.find((e) => e.key === key) ?? null;
}

export const OFFLINE_KEYS = {
  songBook: songBookKey,
  book: bookKey,
  today: todayKey,
};
