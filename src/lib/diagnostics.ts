// Lightweight in-app diagnostics: ring-buffer of console + window errors,
// exposed via the /diagnostics route. Initialised once from the root.

export type DiagLevel = "log" | "info" | "warn" | "error";
export interface DiagEntry {
  id: number;
  at: number;
  level: DiagLevel;
  msg: string;
  detail?: string;
  source?: string;
}

const MAX = 300;
const STORAGE_KEY = "cc.diag.v1";
let buf: DiagEntry[] = [];
let seq = 1;
let initialised = false;
const listeners = new Set<() => void>();

function safeStringify(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.stack || `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, Object.getOwnPropertyNames(v as object));
  } catch {
    return String(v);
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buf.slice(-MAX)));
  } catch {}
}

function emit() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

export function log(level: DiagLevel, msg: string, detail?: unknown, source?: string) {
  const entry: DiagEntry = {
    id: seq++,
    at: Date.now(),
    level,
    msg: typeof msg === "string" ? msg : safeStringify(msg),
    detail: detail === undefined ? undefined : safeStringify(detail),
    source,
  };
  buf.push(entry);
  if (buf.length > MAX) buf = buf.slice(-MAX);
  persist();
  emit();
}

export function getEntries(): DiagEntry[] {
  return buf.slice().reverse();
}

export function clearEntries() {
  buf = [];
  persist();
  emit();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initDiagnostics() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as DiagEntry[];
      if (Array.isArray(arr)) {
        buf = arr.slice(-MAX);
        seq = (buf.at(-1)?.id ?? 0) + 1;
      }
    }
  } catch {}

  const levels: DiagLevel[] = ["log", "info", "warn", "error"];
  for (const lvl of levels) {
    const orig = (console as any)[lvl]?.bind(console);
    if (!orig) continue;
    (console as any)[lvl] = (...args: unknown[]) => {
      try {
        const msg = args.map(safeStringify).join(" ");
        // Avoid capturing our own UI re-renders feedback loops
        if (!msg.startsWith("[diag]")) log(lvl, msg, undefined, "console");
      } catch {}
      orig(...args);
    };
  }

  window.addEventListener("error", (e) => {
    log("error", e.message || "window error", e.error ?? { filename: e.filename, lineno: e.lineno }, "window");
  });
  window.addEventListener("unhandledrejection", (e) => {
    log("error", "Unhandled promise rejection", e.reason, "promise");
  });

  log("info", "Diagnostics initialised", { ua: navigator.userAgent });
}
