import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Copy, RefreshCw, RotateCw, Smartphone, Wifi, Database, Cloud, UploadCloud, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { SettingsGroup, SettingsRow, RowIcon, RowValue } from "../components/settings/SettingsUI";
import { clearEntries, getEntries, subscribe, type DiagEntry, type DiagLevel } from "../lib/diagnostics";
import { listOffline, formatBytes } from "../lib/offline";
import { useSync, useConnectivity, useUploadQueue, useBackgroundSync } from "../offline/hooks";
import { runSync } from "../offline/sync/engine";
import { processQueue, retryUpload, removeUpload } from "../offline/uploads/queue";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Diagnostics — Church Companion" },
      { name: "description", content: "Device diagnostics for Church Companion: connectivity, storage, sync status, upload queue and app logs." },
      { property: "og:title", content: "Diagnostics — Church Companion" },
      { property: "og:description", content: "Connectivity, storage, sync status and app logs for this device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticsPage,
});

function useEntries(): DiagEntry[] {
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  useEffect(() => {
    setEntries(getEntries());
    const unsub = subscribe(() => setEntries(getEntries()));
    return () => { unsub(); };
  }, []);
  return entries;
}

function ChipButton({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="tap-card focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full glass-chip px-3 text-[12px] font-semibold"
    >
      {children}
    </button>
  );
}

function DiagnosticsPage() {
  const [mounted, setMounted] = useState(false);
  const entries = useEntries();
  const [filter, setFilter] = useState<DiagLevel | "all">("all");
  const [storage, setStorage] = useState<{ usage?: number; quota?: number }>({});
  const [offline, setOffline] = useState<ReturnType<typeof listOffline>>([]);

  useEffect(() => {
    setMounted(true);
    setOffline(listOffline());
    if (navigator?.storage?.estimate) {
      navigator.storage.estimate().then((e) => setStorage({ usage: e.usage, quota: e.quota }));
    }
  }, []);

  const shown = filter === "all" ? entries : entries.filter((e) => e.level === filter);

  const copyAll = async () => {
    const txt = entries
      .map((e) => `[${new Date(e.at).toISOString()}] ${e.level.toUpperCase()} ${e.msg}${e.detail ? "\n  " + e.detail : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Copied logs");
    } catch {
      toast.error("Copy failed");
    }
  };

  const sync = useSync();
  const conn = useConnectivity();
  const uploads = useUploadQueue();
  const bgSync = useBackgroundSync();

  return (
    <AppShell title="Diagnostics">
      <div className="space-y-6 pt-4">
        <SettingsGroup label="This device">
          <SettingsRow
            icon={<RowIcon tone="muted"><Smartphone /></RowIcon>}
            title="Browser"
            subtitle={mounted ? navigator.userAgent : "—"}
          />
          <SettingsRow
            icon={<RowIcon tone="muted"><Wifi /></RowIcon>}
            title="Connection"
            subtitle={
              mounted
                ? `${conn.online ? "Online" : "Offline"}${conn.label || conn.effectiveType ? ` · ${conn.label ?? conn.effectiveType}` : ""}${conn.downlink ? ` · ${conn.downlink}Mbps` : ""}${conn.rtt ? ` · ${conn.rtt}ms` : ""}${conn.saveData ? " · data saver" : ""}`
                : "—"
            }
          />
          <SettingsRow
            icon={<RowIcon tone="muted"><Database /></RowIcon>}
            title="Storage used"
            subtitle={mounted ? `${offline.length} offline packs · ${formatBytes(offline.reduce((a, b) => a + b.bytes, 0))}` : "—"}
            trailing={<RowValue>{storage.usage != null ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota ?? 0)}` : "—"}</RowValue>}
          />
          <SettingsRow
            icon={<RowIcon tone="muted"><RotateCw /></RowIcon>}
            title="Background sync"
            trailing={<RowValue>{bgSync.supported ? "Supported" : "Unsupported"}</RowValue>}
          />
        </SettingsGroup>

        <SettingsGroup label="Sync" hint={sync.lastError ?? undefined}>
          <SettingsRow
            icon={<RowIcon><Cloud /></RowIcon>}
            title="Status"
            subtitle={`${sync.pending} pending write${sync.pending === 1 ? "" : "s"}`}
            trailing={
              <span className="flex items-center gap-2">
                <RowValue><span className="capitalize">{sync.status}</span></RowValue>
                <ChipButton onClick={() => runSync()}><RotateCw className="h-3.5 w-3.5" /> Sync</ChipButton>
              </span>
            }
          />
          <SettingsRow
            title="Last synced"
            subtitle={sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "Never"}
          />
        </SettingsGroup>

        <SettingsGroup label="Upload queue">
          <SettingsRow
            icon={<RowIcon><UploadCloud /></RowIcon>}
            title={uploads.length === 0 ? "Nothing queued" : `${uploads.length} in queue`}
            subtitle={uploads.length === 0 ? "Uploads finish automatically when online" : undefined}
            trailing={<ChipButton onClick={() => processQueue()}><RotateCw className="h-3.5 w-3.5" /> Resume</ChipButton>}
          />
          {uploads.map((j) => (
            <SettingsRow
              key={j.id}
              title={j.filename}
              subtitle={`${j.status} · ${formatBytes(j.size)}${j.last_error ? ` · ${j.last_error}` : ""}`}
              trailing={
                <span className="flex items-center gap-1.5">
                  {j.status === "failed" && <ChipButton onClick={() => retryUpload(j.id)}>Retry</ChipButton>}
                  <ChipButton onClick={() => removeUpload(j.id)} label={`Remove ${j.filename}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </ChipButton>
                </span>
              }
            />
          ))}
        </SettingsGroup>

        <SettingsGroup label="Logs" bare className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-1 gap-1 overflow-x-auto rounded-full bg-secondary/70 p-1 text-[12px] font-semibold">
              {(["all", "error", "warn", "info", "log"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setFilter(l)}
                  className={`min-h-8 rounded-full px-3 capitalize transition-colors ${
                    filter === l ? "brand-bg elev-1" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{l}</button>
              ))}
            </div>
            <ChipButton onClick={copyAll}><Copy className="h-3.5 w-3.5" /> Copy</ChipButton>
            <ChipButton onClick={() => { clearEntries(); toast.success("Cleared"); }}><Trash2 className="h-3.5 w-3.5" /> Clear</ChipButton>
            <ChipButton onClick={() => location.reload()} label="Reload app"><RefreshCw className="h-3.5 w-3.5" /></ChipButton>
          </div>

          <div className="space-y-2">
            {shown.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <ScrollText className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No log entries.</p>
              </Card>
            ) : shown.map((e) => (
              <Card key={e.id} className="p-3.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    e.level === "error" ? "bg-destructive/15 text-destructive" :
                    e.level === "warn" ? "bg-amber-500/15 text-amber-600" :
                    "bg-secondary text-muted-foreground"
                  }`}>{e.level}</span>
                  <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
                  {e.source && <span className="truncate text-muted-foreground">· {e.source}</span>}
                </div>
                <p className="mt-1.5 break-words font-medium">{e.msg}</p>
                {e.detail && <pre className="mt-1 whitespace-pre-wrap break-words text-[10.5px] text-muted-foreground">{e.detail}</pre>}
              </Card>
            ))}
          </div>
        </SettingsGroup>
      </div>
    </AppShell>
  );
}
