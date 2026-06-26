import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { useT } from "../lib/i18n";
import { ACCENT_PRESETS, useSettings, type FontSize, type ThemeMode, type Language } from "../lib/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Church Companion" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useT();
  const s = useSettings();

  return (
    <AppShell title={t("nav.settings")}>
      <div className="space-y-5 pt-4">
        <Section label={t("settings.font_size")}>
          <div className="grid grid-cols-4 gap-2">
            {(["s","m","l","xl"] as FontSize[]).map((sz) => (
              <button
                key={sz}
                onClick={() => s.setFontSize(sz)}
                className={`rounded-xl py-2.5 text-sm font-medium border ${s.fontSize === sz ? "brand-bg brand-border" : "bg-card"}`}
              >{t(`fs.${sz}`)}</button>
            ))}
          </div>
        </Section>

        <Section label={t("settings.theme")}>
          <div className="grid grid-cols-3 gap-2">
            {(["light","dark","system"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => s.setTheme(m)}
                className={`rounded-xl py-2.5 text-sm font-medium border ${s.theme === m ? "brand-bg brand-border" : "bg-card"}`}
              >{t(`settings.${m}`)}</button>
            ))}
          </div>
        </Section>

        <Section label={t("settings.accent")}>
          <div className="grid grid-cols-6 gap-2">
            {ACCENT_PRESETS.map((a) => (
              <button
                key={a.id}
                aria-label={a.name}
                onClick={() => s.setAccent(a.value)}
                className={`relative h-11 rounded-xl border-2 ${s.accent === a.value ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                style={{ backgroundColor: a.value, borderColor: a.value }}
              />
            ))}
          </div>
        </Section>

        <Section label={t("settings.language")}>
          <div className="grid grid-cols-2 gap-2">
            {(["en","hi"] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => s.setLanguage(l)}
                className={`rounded-xl py-2.5 text-sm font-medium border ${s.language === l ? "brand-bg brand-border" : "bg-card"}`}
              >{l === "en" ? "English" : "हिन्दी"}</button>
            ))}
          </div>
        </Section>

        <Card className="p-4 text-xs text-muted-foreground">
          <p>Bookmarks and preferences are stored on this device only.</p>
        </Card>
      </div>
    </AppShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}
