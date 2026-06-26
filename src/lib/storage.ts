// Local-only persistence for bookmarks, favorites, and continue-reading.
// No cross-device sync by design.

const FAV_KEY = "cc.favSongs.v1";
const BOOKMARK_KEY = "cc.bookmarks.v1";
const CONTINUE_KEY = "cc.continue.v1";

export interface Bookmark {
  id: string; // songId or sectionId
  kind: "song" | "section";
  bookSlug: string;
  title: string;
  number?: number | null;
  addedAt: number;
}

export interface ContinueItem {
  id: string;
  kind: "song" | "section";
  bookSlug: string;
  title: string;
  at: number;
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

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  try { window.dispatchEvent(new CustomEvent("cc:storage", { detail: { key } })); } catch {}
}

export const favorites = {
  list: () => read<string[]>(FAV_KEY, []),
  has: (id: string) => read<string[]>(FAV_KEY, []).includes(id),
  toggle: (id: string) => {
    const list = read<string[]>(FAV_KEY, []);
    const idx = list.indexOf(id);
    if (idx >= 0) list.splice(idx, 1); else list.unshift(id);
    write(FAV_KEY, list);
    return list.includes(id);
  },
};

export const bookmarks = {
  list: () => read<Bookmark[]>(BOOKMARK_KEY, []),
  has: (id: string) => read<Bookmark[]>(BOOKMARK_KEY, []).some((b) => b.id === id),
  toggle: (b: Bookmark) => {
    const list = read<Bookmark[]>(BOOKMARK_KEY, []);
    const idx = list.findIndex((x) => x.id === b.id);
    if (idx >= 0) list.splice(idx, 1); else list.unshift(b);
    write(BOOKMARK_KEY, list);
    return list.some((x) => x.id === b.id);
  },
  remove: (id: string) => {
    const list = read<Bookmark[]>(BOOKMARK_KEY, []).filter((b) => b.id !== id);
    write(BOOKMARK_KEY, list);
  },
};

export const continueReading = {
  get: () => read<ContinueItem | null>(CONTINUE_KEY, null),
  set: (item: ContinueItem) => write(CONTINUE_KEY, item),
  clear: () => write(CONTINUE_KEY, null),
};

export function useStorageVersion() {
  // Simple subscribe helper for React.
  return { FAV_KEY, BOOKMARK_KEY, CONTINUE_KEY };
}
