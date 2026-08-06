import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  Download,
  Loader2,
  CheckCircle2,
  Trash2,
  HardDrive,
  Shield,
  Type,
  Palette,
  SunMoon,
  Languages,
  Sparkles,
  Stethoscope,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import {
  SettingsGroup,
  SettingsRow,
  SettingsLinkRow,
  SettingsButtonRow,
  RowIcon,
  RowValue,
  Segmented,
} from "../components/settings/SettingsUI";

import { useT } from "../lib/i18n";
import { ACCENT_PRESETS, useSettings, type FontSize, type ThemeMode, type Language } from "../lib/settings";
import { getPushPermission, promptForPush, setPushOptIn, getPushOptedIn } from "../lib/onesignal";
import { downloadEntireApp, removeAllOffline, useOfflineIndex, formatBytes, type FullDownloadProgress } from "../lib/offline";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Church Companion" },
      { name: "description", content: "Personalise Church Companion: text size, theme, accent colour, language, notifications and offline downloads." },
      { property: "og:title", content: "Settings — Church Companion" },
      { property: "og:description", content: "Personalise appearance, language, notifications and offline access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useT();
  const s = useSettings();

  return (
    <AppShell title={t("nav.settings")}>
      <div className="space-y-6 pt-4">
        <SettingsGroup label="Admin">
          <SettingsLinkRow
            to="/admin"
            icon={<RowIcon><Shield /></RowIcon>}
            title="Admin login"
            subtitle="Sign in or request admin access"
          />
        </SettingsGroup>

        <SettingsGroup label="Appearance">
          <div>
            <SettingsRow
              icon={<RowIcon><Type /></RowIcon>}
              title={t("settings.font_size")}
              subtitle="Reading size across books and songs"
            />
            <div className="px-4 pb-4">
              <Segmented<FontSize>
                ariaLabel={t("settings.font_size")}
                value={s.fontSize}
                onChange={s.setFontSize}
                options={(["s", "m", "l", "xl"] as FontSize[]).map((sz) => ({ value: sz, label: t(`fs.${sz}`) }))}
              />
            </div>
          </div>

          <div>
            <SettingsRow
              icon={<RowIcon><SunMoon /></RowIcon>}
              title={t("settings.theme")}
              subtitle="Light, dark, or follow the device"
            />
            <div className="px-4 pb-4">
              <Segmented<ThemeMode>
                ariaLabel={t("settings.theme")}
                value={s.theme}
                onChange={s.setTheme}
                options={(["light", "dark", "system"] as ThemeMode[]).map((m) => ({ value: m, label: t(`settings.${m}`) }))}
              />
            </div>
          </div>

          <div>
            <SettingsRow
              icon={<RowIcon><Palette /></RowIcon>}
              title={t("settings.accent")}
              subtitle="Highlight colour for buttons and tabs"
            />
            <div className="flex flex-wrap gap-3.5 px-5 pb-5 pt-0.5">
              {ACCENT_PRESETS.map((a) => {
                const active = s.accent === a.value;
                return (
                  <button
                    key={a.id}
                    aria-label={a.name}
                    aria-pressed={active}
                    onClick={() => s.setAccent(a.value)}
                    className={`focus-ring relative grid h-9 w-9 place-items-center rounded-full transition-transform duration-200 active:scale-90 ${active ? "scale-105" : ""}`}
                    style={{
                      backgroundColor: a.value,
                      boxShadow: active
                        ? `0 0 0 2px var(--background), 0 0 0 4px ${a.value}`
                        : "inset 0 0 0 1px color-mix(in oklab, black 12%, transparent)",
                    }}
                  >
                    {active && <CheckCircle2 className="h-4 w-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <SettingsRow
              icon={<RowIcon><Sparkles /></RowIcon>}
              title="Dock glass blur"
              subtitle="Lower is solid, higher is more frosted"
              trailing={<RowValue>{Math.round(s.dockBlur)}px</RowValue>}
            />
            <div className="px-5 pb-5">
              <Slider
                min={0}
                max={60}
                step={1}
                value={[s.dockBlur]}
                onValueChange={(v) => s.setDockBlur(v[0] ?? 45)}
                aria-label="Home dock blur strength"
              />
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup label={t("settings.language")}>
          <div>
            <SettingsRow
              icon={<RowIcon><Languages /></RowIcon>}
              title={t("settings.language")}
              subtitle="App text and labels"
            />
            <div className="px-4 pb-4">
              <Segmented<Language>
                ariaLabel={t("settings.language")}
                value={s.language}
                onChange={s.setLanguage}
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "हिन्दी" },
                ]}
              />
            </div>
          </div>

        </SettingsGroup>

        <NotificationsSection />

        <OfflineSection />

        <SettingsGroup label="About this device">
          <SettingsLinkRow
            to="/diagnostics"
            icon={<RowIcon tone="muted"><Stethoscope /></RowIcon>}
            title="Diagnostics"
            subtitle="Sync status, storage and logs"
          />
          <SettingsRow
            icon={<RowIcon tone="muted"><Info /></RowIcon>}
            title="Stored on this device"
            subtitle="Bookmarks and preferences never leave your phone"
          />
        </SettingsGroup>

        <p className="px-1 pb-2 text-center text-[11px] text-muted-foreground">
          Church Companion · <Link to="/diagnostics" className="underline-offset-2 hover:underline">diagnostics</Link>
        </p>
      </div>
    </AppShell>
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
    <SettingsGroup
      label="Notifications"
      hint={perm === "denied" ? "Open browser settings for this site, allow notifications, then reload." : undefined}
    >
      {perm === "unsupported" ? (
        <SettingsRow
          icon={<RowIcon tone="muted"><BellOff /></RowIcon>}
          title="Not supported"
          subtitle="This device or browser can't receive push notifications"
        />
      ) : perm === "granted" ? (
        <SettingsRow
          icon={<RowIcon>{optedIn ? <Bell /> : <BellOff />}</RowIcon>}
          title="Push notifications"
          subtitle={optedIn ? "You'll hear about new announcements" : "Currently turned off"}
          trailing={
            <Switch checked={optedIn} onCheckedChange={toggle} disabled={busy} aria-label="Toggle push notifications" />
          }
        />
      ) : perm === "denied" ? (
        <SettingsRow
          icon={<RowIcon tone="danger"><BellOff /></RowIcon>}
          title="Notifications are blocked"
          subtitle="Permission was denied for this site"
        />
      ) : (
        <SettingsButtonRow
          onClick={enable}
          disabled={busy}
          icon={<RowIcon><Bell /></RowIcon>}
          title={busy ? "Please wait…" : "Enable notifications"}
          subtitle="Get announcements and today's songs"
          trailing={busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : undefined}
        />
      )}
    </SettingsGroup>
  );
}

function OfflineSection() {
  const entries = useOfflineIndex();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<FullDownloadProgress | null>(null);
  const totalBytes = entries.reduce((a, e) => a + e.bytes, 0);
  const hasAny = entries.length > 0;

  const downloadAll = async () => {
    if (busy) return;
    setBusy(true);
    setProgress({ step: "Starting…", done: 0, total: 1 });
    try {
      const r = await downloadEntireApp(supabase, (p) => setProgress(p));
      toast.success(`Saved ${r.books} books · ${r.songs} sections${r.today ? " · today" : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const removeAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await removeAllOffline();
      toast.success("Offline content cleared");
    } finally {
      setBusy(false);
    }
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <SettingsGroup
      label="Offline access"
      hint="Every book, song and today's set is stored on this device so the app opens without internet."
    >
      <div>
      <SettingsRow
        icon={<RowIcon><HardDrive /></RowIcon>}
        title="Whole app offline"
        subtitle={hasAny ? `${entries.length} packs · ${formatBytes(totalBytes)} saved` : "Nothing downloaded yet"}
        trailing={hasAny ? <CheckCircle2 className="h-5 w-5 brand-text" /> : undefined}
      />

      {busy && progress && (
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="truncate text-muted-foreground">{progress.step}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--brand), var(--gold, var(--brand)))" }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 p-3">
        <button
          onClick={downloadAll}
          disabled={busy}
          className="tap-card focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full brand-bg text-[14px] font-semibold elev-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAny ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {busy ? "Downloading…" : hasAny ? "Refresh offline copy" : "Download everything"}
        </button>
        {hasAny && !busy && (
          <button
            onClick={removeAll}
            aria-label="Remove all offline content"
            className="tap-card focus-ring inline-flex min-h-11 items-center justify-center rounded-full glass-chip px-4 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      </div>
    </SettingsGroup>
  );
}
