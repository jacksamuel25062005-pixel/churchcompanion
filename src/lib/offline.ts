// Offline content snapshots persisted to IndexedDB (via idb-keyval), with a
// small metadata index kept in localStorage so the UI can render download
// status synchronously. Snapshots themselves are stored in IDB to avoid the
// ~5MB localStorage cap and to keep big books fast.

import { del, get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import type { Book, BookSection, Song, TodaySet } from "./types";

const PREFIX = "cc.offline.";
const INDEX_KEY = "cc.offline.index.v2";

export type OfflineKind = "song-book" | "book" | "today";

export interface OfflineEntry {
  key: string;
  kind: OfflineKind;
  slug: string;
  label: string;
  count: number;
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

// ---------------- Index (localStorage, sync) ----------------

function readIndex(): Record<string, OfflineEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OfflineEntry>) : {};
  } catch {
    return {};
  }
}
function writeIndex(idx: Record<string, OfflineEntry>) {
  if (typeof window === "undefined") return;
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

// ---------------- IDB helpers ----------------

async function putSnap(key: string, value: unknown): Promise<number> {
  await set(key, value);
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}
async function getSnap<T>(key: string): Promise<T | null> {
  try {
    const v = await get<T>(key);
    return (v ?? null) as T | null;
  } catch {
    return null;
  }
}

// ---------------- Keys ----------------

const songBookKey = () => `${PREFIX}song-book`;
const bookKey = (slug: string) => `${PREFIX}book.${slug}`;
const todayKey = () => `${PREFIX}today`;

export const OFFLINE_KEYS = {
  songBook: songBookKey,
  book: bookKey,
  today: todayKey,
};

// ---------------- Song Book ----------------

export async function saveSongBook(snap: SongBookSnap) {
  const key = songBookKey();
  const bytes = await putSnap(key, snap);
  setIndex({
    key,
    kind: "song-book",
    slug: "song-book",
    label: snap.book.title_en || snap.book.title_hi || "Song Book",
    count: snap.songs.length,
    bytes,
    at: snap.at,
  });
}
export async function loadSongBookSnap(): Promise<SongBookSnap | null> {
  return getSnap<SongBookSnap>(songBookKey());
}

// ---------------- Generic Book ----------------

export async function saveBook(slug: string, snap: BookSnap) {
  const key = bookKey(slug);
  const bytes = await putSnap(key, snap);
  setIndex({
    key,
    kind: "book",
    slug,
    label: snap.book.title_en || snap.book.title_hi || slug,
    count: snap.sections.length,
    bytes,
    at: snap.at,
  });
}
export async function loadBookSnap(slug: string): Promise<BookSnap | null> {
  return getSnap<BookSnap>(bookKey(slug));
}

// ---------------- Today ----------------

export async function saveToday(snap: TodaySnap) {
  const key = todayKey();
  const bytes = await putSnap(key, snap);
  setIndex({
    key,
    kind: "today",
    slug: "today",
    label: snap.set?.title || "Today's Songs",
    count: snap.items.length,
    bytes,
    at: snap.at,
  });
}
export async function loadTodaySnap(): Promise<TodaySnap | null> {
  return getSnap<TodaySnap>(todayKey());
}

// ---------------- Removal & listing ----------------

export async function removeOffline(key: string) {
  try {
    await del(key);
  } catch {}
  unsetIndex(key);
}
export function listOffline(): OfflineEntry[] {
  return Object.values(readIndex()).sort((a, b) => b.at - a.at);
}
export function isDownloaded(key: string): boolean {
  return !!readIndex()[key];
}

// ---------------- Download everything ----------------

export interface FullDownloadProgress {
  step: string;
  done: number;
  total: number;
}

export async function downloadEntireApp(
  supabase: any,
  onProgress?: (p: FullDownloadProgress) => void,
): Promise<{ books: number; songs: number; today: boolean }> {
  const todayDate = new Date().toISOString().slice(0, 10);

  // 1. Books list
  onProgress?.({ step: "Loading books…", done: 0, total: 1 });
  const { data: books, error: be } = await supabase.from("books").select("*").order("sort_order");
  if (be) throw be;
  const bookList = (books ?? []) as Book[];

  // Steps: songs + each non-song book + today
  const total = 1 + bookList.filter((b) => b.slug !== "song-book").length + 1;
  let done = 0;

  // 2. Song book (songs table)
  const songBookMeta = bookList.find((b) => b.slug === "song-book");
  if (songBookMeta) {
    onProgress?.({ step: "Songs…", done, total });
    const { data: songs, error } = await supabase
      .from("songs")
      .select("*")
      .order("number", { ascending: true, nullsFirst: false });
    if (error) throw error;
    await saveSongBook({ book: songBookMeta, songs: (songs ?? []) as Song[], at: Date.now() });
  }
  done++;

  // 3. Each generic book
  let songCount = 0;
  for (const b of bookList) {
    if (b.slug === "song-book") continue;
    onProgress?.({ step: `${b.title_en || b.slug}…`, done, total });
    const { data: sections, error } = await supabase
      .from("book_sections")
      .select("*")
      .eq("book_id", b.id)
      .order("sort_order")
      .order("number");
    if (error) throw error;
    const list = (sections ?? []) as BookSection[];
    songCount += list.length;
    await saveBook(b.slug, { book: b, sections: list, at: Date.now() });
    done++;
  }

  // 4. Today
  onProgress?.({ step: "Today's songs…", done, total });
  let todaySaved = false;
  try {
    const { data: sets } = await supabase
      .from("today_song_sets")
      .select("id, title, note, for_date")
      .eq("for_date", todayDate)
      .order("published_at", { ascending: false })
      .limit(1);
    const set = sets?.[0] ?? null;
    let items: Song[] = [];
    if (set) {
      const { data: rows } = await supabase
        .from("today_song_items")
        .select("position, songs:song_id(*)")
        .eq("set_id", set.id)
        .order("position");
      items = ((rows ?? []) as any[]).map((r) => r.songs).filter(Boolean) as Song[];
    }
    await saveToday({ set, items, at: Date.now(), for_date: todayDate });
    todaySaved = true;
  } catch {
    /* today is best-effort */
  }
  done++;
  onProgress?.({ step: "Done", done, total });

  return { books: bookList.length, songs: songCount, today: todaySaved };
}

export async function removeAllOffline() {
  const all = listOffline();
  for (const e of all) await removeOffline(e.key);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------- Hooks ----------------

function useOfflineTick() {
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
  return tick;
}

export function useOfflineIndex() {
  useOfflineTick();
  return listOffline();
}

export function useIsDownloaded(key: string) {
  const list = useOfflineIndex();
  return list.find((e) => e.key === key) ?? null;
}

function useIdbSnap<T>(loader: () => Promise<T | null>, deps: unknown[] = []) {
  const tick = useOfflineTick();
  const [snap, setSnap] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    loader().then((v) => {
      if (alive) setSnap(v);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return snap;
}

export function useSongBookSnap() {
  return useIdbSnap<SongBookSnap>(loadSongBookSnap);
}
export function useBookSnap(slug: string) {
  return useIdbSnap<BookSnap>(() => loadBookSnap(slug), [slug]);
}
export function useTodaySnap() {
  return useIdbSnap<TodaySnap>(loadTodaySnap);
}
