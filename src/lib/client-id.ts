// Stable per-device anonymous client id used to dedupe likes and identify
// the poster of anonymous comments without requiring login.
const KEY = "cc.client_id";

export function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try { window.localStorage.setItem(KEY, id); } catch {}
  }
  return id;
}
