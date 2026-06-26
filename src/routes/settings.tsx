import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { Switch } from "../components/ui/switch";
import { useT } from "../lib/i18n";
import { ACCENT_PRESETS, useSettings, type FontSize, type ThemeMode, type Language } from "../lib/settings";
import { getPushPermission, promptForPush, setPushOptIn, getPushOptedIn } from "../lib/onesignal";

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

        <NotificationsSection />

        <Card className="p-4 text-xs text-muted-foreground space-y-2">
          <p>Bookmarks and preferences are stored on this device only.</p>
          <Link to="/diagnostics" className="inline-block text-foreground font-medium underline-offset-2 hover:underline">Open diagnostics →</Link>
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

function NotificationsSection() {
  const [perm, setPerm] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [optedIn, setOptedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushPermission().then(setPerm);
    getPushOptedIn().then(setOptedIn);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const ok = await promptForPush();
      setPerm(ok ? "granted" : (Notification.permission as any));
      if (ok) {
        await setPushOptIn(true);
        setOptedIn(true);
        toast.success("Notifications enabled");
      } else toast.error("Permission not granted");
    } finally { setBusy(false); }
  };

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await setPushOptIn(next);
      setOptedIn(next);
      toast.success(next ? "Push notifications on" : "Push notifications off");
    } finally { setBusy(false); }
  };

  return (
    <Section label="Notifications">
      <Card className="p-4">
        {perm === "unsupported" ? (
          <p className="text-xs text-muted-foreground">Push notifications are not supported on this device.</p>
        ) : perm === "granted" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {optedIn ? <Bell className="h-4 w-4 brand-text" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              <span>{optedIn ? "Push notifications on" : "Push notifications off"}</span>
            </div>
            <Switch checked={optedIn} onCheckedChange={toggle} disabled={busy} aria-label="Toggle push notifications" />
          </div>
        ) : perm === "denied" ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm"><BellOff className="h-4 w-4 text-muted-foreground" /> Notifications are blocked.</div>
            <p className="text-xs text-muted-foreground">Allow notifications for this site in your browser settings.</p>
          </div>
        ) : (
          <button onClick={enable} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-bg py-2.5 text-sm font-medium disabled:opacity-50">
            <Bell className="h-4 w-4" /> {busy ? "…" : "Enable notifications"}
          </button>
        )}
      </Card>
    </Section>
  );
}
