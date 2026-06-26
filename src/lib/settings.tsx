import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type FontSize = "s" | "m" | "l" | "xl";
export type ThemeMode = "light" | "dark" | "system";
export type Language = "en" | "hi";

export interface AccentOption {
  id: string;
  name: string;
  value: string; // hex
}

export const ACCENT_PRESETS: AccentOption[] = [
  { id: "indigo", name: "Indigo", value: "#6366f1" },
  { id: "rose", name: "Rose", value: "#e11d48" },
  { id: "emerald", name: "Emerald", value: "#059669" },
  { id: "amber", name: "Amber", value: "#d97706" },
  { id: "violet", name: "Violet", value: "#7c3aed" },
  { id: "slate", name: "Slate", value: "#475569" },
];

interface Settings {
  fontSize: FontSize;
  theme: ThemeMode;
  accent: string; // hex
  language: Language;
}

const DEFAULT: Settings = {
  fontSize: "m",
  theme: "system",
  accent: "#6366f1",
  language: "en",
};

const STORAGE_KEY = "cc.settings.v1";

interface Ctx extends Settings {
  setFontSize: (v: FontSize) => void;
  setTheme: (v: ThemeMode) => void;
  setAccent: (v: string) => void;
  setLanguage: (v: Language) => void;
}

const SettingsContext = createContext<Ctx | null>(null);

function readSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function applyToDOM(s: Settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  ["fs-s", "fs-m", "fs-l", "fs-xl"].forEach((c) => root.classList.remove(c));
  root.classList.add(`fs-${s.fontSize}`);

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = s.theme === "dark" || (s.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.style.setProperty("--brand", s.accent);
  root.style.setProperty("--brand-foreground", "#ffffff");
  root.lang = s.language;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT);

  useEffect(() => {
    const s = readSettings();
    setSettings(s);
    applyToDOM(s);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDOM(readSettings());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      applyToDOM(next);
      return next;
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        setFontSize: (v) => update({ fontSize: v }),
        setTheme: (v) => update({ theme: v }),
        setAccent: (v) => update({ accent: v }),
        setLanguage: (v) => update({ language: v }),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

/** Override the brand color for the current route (e.g. a book theme). */
export function useBrandOverride(hex: string | null | undefined) {
  const { accent } = useSettings();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--brand", hex || accent);
    return () => {
      root.style.setProperty("--brand", accent);
    };
  }, [hex, accent]);
}
