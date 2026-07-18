import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type FontSize = "s" | "m" | "l" | "xl";
export type ThemeMode = "light" | "dark" | "system";
export type Language = "en" | "hi";
export type FontFamilyId =
  | "system"
  | "inter"
  | "poppins"
  | "manrope"
  | "nunito"
  | "source-sans"
  | "space-grotesk"
  | "baloo"
  | "lora"
  | "merriweather"
  | "playfair"
  | "roboto-slab";

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

export interface FontFamilyOption {
  id: FontFamilyId;
  name: string;
  sans: string;
  display: string;
  category: "sans" | "serif" | "display";
}

const DEFAULT_SANS = `"Inter", "Manrope", "Noto Sans Devanagari", system-ui, sans-serif`;
const DEFAULT_DISPLAY = `"Poppins", "Space Grotesk", "Manrope", system-ui, sans-serif`;

export const FONT_FAMILY_PRESETS: FontFamilyOption[] = [
  { id: "system", name: "Default", sans: DEFAULT_SANS, display: DEFAULT_DISPLAY, category: "sans" },
  { id: "inter", name: "Inter", sans: `"Inter", system-ui, sans-serif`, display: `"Inter", system-ui, sans-serif`, category: "sans" },
  { id: "poppins", name: "Poppins", sans: `"Poppins", system-ui, sans-serif`, display: `"Poppins", system-ui, sans-serif`, category: "sans" },
  { id: "manrope", name: "Manrope", sans: `"Manrope", system-ui, sans-serif`, display: `"Manrope", system-ui, sans-serif`, category: "sans" },
  { id: "nunito", name: "Nunito", sans: `"Nunito", system-ui, sans-serif`, display: `"Nunito", system-ui, sans-serif`, category: "sans" },
  { id: "source-sans", name: "Source Sans", sans: `"Source Sans 3", system-ui, sans-serif`, display: `"Source Sans 3", system-ui, sans-serif`, category: "sans" },
  { id: "space-grotesk", name: "Space Grotesk", sans: `"Space Grotesk", system-ui, sans-serif`, display: `"Space Grotesk", system-ui, sans-serif`, category: "display" },
  { id: "baloo", name: "Baloo 2", sans: `"Baloo 2", system-ui, sans-serif`, display: `"Baloo 2", system-ui, sans-serif`, category: "display" },
  { id: "lora", name: "Lora", sans: `"Lora", Georgia, serif`, display: `"Lora", Georgia, serif`, category: "serif" },
  { id: "merriweather", name: "Merriweather", sans: `"Merriweather", Georgia, serif`, display: `"Merriweather", Georgia, serif`, category: "serif" },
  { id: "playfair", name: "Playfair Display", sans: `"Playfair Display", Georgia, serif`, display: `"Playfair Display", Georgia, serif`, category: "serif" },
  { id: "roboto-slab", name: "Roboto Slab", sans: `"Roboto Slab", Georgia, serif`, display: `"Roboto Slab", Georgia, serif`, category: "serif" },
];

interface Settings {
  fontSize: FontSize;
  theme: ThemeMode;
  accent: string; // hex
  language: Language;
  fontFamily: FontFamilyId;
}

const DEFAULT: Settings = {
  fontSize: "m",
  theme: "system",
  accent: "#6366f1",
  language: "en",
  fontFamily: "system",
};

const STORAGE_KEY = "cc.settings.v1";

interface Ctx extends Settings {
  setFontSize: (v: FontSize) => void;
  setTheme: (v: ThemeMode) => void;
  setAccent: (v: string) => void;
  setLanguage: (v: Language) => void;
  setFontFamily: (v: FontFamilyId) => void;
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
  const font = FONT_FAMILY_PRESETS.find((f) => f.id === s.fontFamily) ?? FONT_FAMILY_PRESETS[0];
  root.style.setProperty("--font-sans", font.sans);
  root.style.setProperty("--font-display", font.display);
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
        setFontFamily: (v) => update({ fontFamily: v }),
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
