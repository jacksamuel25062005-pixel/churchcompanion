// Device-local conversation preferences (pin / mute / favourite / archive).
// Kept local because the church channels are shared rooms — these flags are a
// personal organisation aid, not shared state.

import type { ChatChannel } from "./chat";

export interface ChatPrefs {
  pinned: boolean;
  muted: boolean;
  favorite: boolean;
  archived: boolean;
}

const KEY = "cc.chat.prefs";
const EMPTY: ChatPrefs = { pinned: false, muted: false, favorite: false, archived: false };

type Store = Record<string, ChatPrefs>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("cc:chat-prefs"));
}

export function getPrefs(channel: ChatChannel): ChatPrefs {
  return { ...EMPTY, ...(read()[channel] ?? {}) };
}

export function allPrefs(): Store {
  return read();
}

export function togglePref(channel: ChatChannel, key: keyof ChatPrefs) {
  const store = read();
  const current = { ...EMPTY, ...(store[channel] ?? {}) };
  current[key] = !current[key];
  store[channel] = current;
  write(store);
  return current;
}

export function setPref(channel: ChatChannel, key: keyof ChatPrefs, value: boolean) {
  const store = read();
  const current = { ...EMPTY, ...(store[channel] ?? {}) };
  current[key] = value;
  store[channel] = current;
  write(store);
  return current;
}

export function onPrefsChange(cb: () => void) {
  const handler = () => cb();
  window.addEventListener("cc:chat-prefs", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("cc:chat-prefs", handler);
    window.removeEventListener("storage", handler);
  };
}
