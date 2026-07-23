import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, BellOff, Download, Loader2, CheckCircle2, Trash2, HardDrive, Shield, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { Switch } from "../components/ui/switch";
import { useT } from "../lib/i18n";
import { ACCENT_PRESETS, FONT_FAMILY_PRESETS, useSettings, type FontSize, type ThemeMode, type Language } from "../lib/settings";
import { getPushPermission, promptForPush, setPushOptIn, getPushOptedIn } from "../lib/onesignal";
import { downloadEntireApp, removeAllOffline, useOfflineIndex, formatBytes, type FullDownloadProgress } from "../lib/offline";


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
        <Section label="Admin">
          <Link
            to="/admin"
            className="premium-card tap-card focus-ring flex items-center gap-3 hover:bg-secondary/50 transition-colors"
          >
            <span className="grid place-items-center h-11 w-11 rounded-2xl brand-bg elev-1 shrink-0">
              <Shield className="h-5 w-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">Admin Login</span>
              <span className="block text-xs text-muted-foreground">Sign in or request admin access</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Section>


        <Section label={t("settings.font_size")}>

          <div className="grid grid-cols-4 gap-2">
            {(["s","m","l","xl"] as FontSize[]).map((sz) => (
              <SegButton key={sz} active={s.fontSize === sz} onClick={() => s.setFontSize(sz)}>
                {t(`fs.${sz}`)}
              </SegButton>
            ))}
          </div>
        </Section>

        <Section label={t("settings.theme")}>
          <div className="grid grid-cols-3 gap-2">
            {(["light","dark","system"] as ThemeMode[]).map((m) => (
              <SegButton key={m} active={s.theme === m} onClick={() => s.setTheme(m)}>
                {t(`settings.${m}`)}
              </SegButton>
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
                className={`focus-ring relative h-11 w-11 min-w-11 rounded-2xl transition-all ${s.accent === a.value ? "elev-1 ring-2 ring-offset-2 ring-offset-background" : ""}`}
                style={{ backgroundColor: a.value, boxShadow: s.accent === a.value ? undefined : "inset 0 0 0 1px color-mix(in oklab, black 10%, transparent)", ...(s.accent === a.value ? { ["--tw-ring-color" as any]: a.value } : {}) }}
              />
            ))}
          </div>
        </Section>

        <Section label="Font family">
          <FontFamilyRow />
        </Section>

        <Section label={t("settings.language")}>
          <div className="grid grid-cols-2 gap-2">
            {(["en","hi"] as Language[]).map((l) => (
              <SegButton key={l} active={s.language === l} onClick={() => s.setLanguage(l)}>
                {l === "en" ? "English" : "हिन्दी"}
              </SegButton>
            ))}
          </div>
        </Section>


        <NotificationsSection />

        <OfflineSection />





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

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring rounded-xl py-2.5 min-h-11 text-sm font-medium tap-card transition-all ${
        active
          ? "brand-bg elev-1 ring-2 brand-ring ring-offset-2 ring-offset-background"
          : "glass-chip hover:bg-secondary/50"
      }`}
    >
      {children}
    </button>
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
          <p className="text-xs text-muted-foreground">Push notifications aren't supported on this device or browser.</p>
        ) : perm === "granted" ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="grid place-items-center h-9 w-9 rounded-xl brand-bg elev-1 shrink-0">
                {optedIn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </span>
              <span className="font-medium">{optedIn ? "Push notifications on" : "Push notifications off"}</span>
            </div>
            <Switch checked={optedIn} onCheckedChange={toggle} disabled={busy} aria-label="Toggle push notifications" />
          </div>
        ) : perm === "denied" ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm"><BellOff className="h-4 w-4 text-muted-foreground" /> Notifications are blocked.</div>
            <p className="text-xs text-muted-foreground">Open browser settings for this site and allow notifications, then reload.</p>
          </div>
        ) : (
          <button
            onClick={enable}
            disabled={busy}
            className="tap-card focus-ring w-full inline-flex items-center justify-center gap-2 rounded-xl brand-bg py-3 min-h-11 text-sm font-semibold elev-1 disabled:opacity-50"
          >
            <Bell className="h-4 w-4" /> {busy ? "Please wait…" : "Enable notifications"}
          </button>
        )}
      </Card>
    </Section>
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
    <Section label="Offline access">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <HardDrive className="h-4 w-4 brand-text" />
          <span className="font-medium">Whole app offline</span>
          {hasAny && (
            <span className="ml-auto text-xs text-muted-foreground">
              {entries.length} packs · {formatBytes(totalBytes)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Download every book, song, and today's set to this device. Once saved, the app opens and reads without internet.
        </p>

        {busy && progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{progress.step}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--brand), var(--gold, var(--brand)))",
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={downloadAll}
            disabled={busy}
            className="tap-card focus-ring flex-1 inline-flex items-center justify-center gap-2 rounded-xl brand-bg py-3 min-h-11 text-sm font-semibold elev-1 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAny ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {busy ? "Downloading…" : hasAny ? "Refresh offline copy" : "Download everything"}
          </button>
          {hasAny && !busy && (
            <button
              onClick={removeAll}
              className="tap-card focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl glass-chip px-3.5 min-h-11 text-sm font-medium"
              aria-label="Remove all offline content"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </Card>
    </Section>
  );
}

