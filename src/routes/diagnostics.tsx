import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Copy, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui-bits";
import { clearEntries, getEntries, subscribe, type DiagEntry, type DiagLevel } from "../lib/diagnostics";
import { listOffline, formatBytes } from "../lib/offline";
import { useSync, useConnectivity, useUploadQueue, useBackgroundSync } from "../offline/hooks";
import { runSync } from "../offline/sync/engine";
import { processQueue, retryUpload, removeUpload } from "../offline/uploads/queue";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({ meta: [{ title: "Diagnostics — Church Companion" }] }),
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

  return (
    <AppShell title="Diagnostics">
      <div className="pt-4 space-y-4">
        <Card className="p-4 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">User Agent</span><span className="truncate max-w-[60%] text-right">{mounted ? navigator.userAgent : "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Online</span><span>{mounted ? (navigator.onLine ? "Yes" : "No") : "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Storage</span><span>{storage.usage != null ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota ?? 0)}` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Offline packs</span><span>{mounted ? `${offline.length} (${formatBytes(offline.reduce((a, b) => a + b.bytes, 0))})` : "—"}</span></div>
        </Card>


        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-secondary p-1 text-xs font-medium">
            {(["all", "error", "warn", "info", "log"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setFilter(l)}
                className={`rounded-lg px-2.5 py-1 capitalize ${filter === l ? "bg-card shadow" : ""}`}
              >{l}</button>
            ))}
          </div>
          <button onClick={copyAll} className="ml-auto inline-flex items-center gap-1 glass-chip rounded-full px-3 py-1.5 text-xs font-medium">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button onClick={() => { clearEntries(); toast.success("Cleared"); }} className="inline-flex items-center gap-1 glass-chip rounded-full px-3 py-1.5 text-xs font-medium">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
          <button onClick={() => location.reload()} className="inline-flex items-center gap-1 glass-chip rounded-full px-3 py-1.5 text-xs font-medium">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {shown.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No log entries.</Card>
          ) : shown.map((e) => (
            <Card key={e.id} className="p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 font-semibold uppercase text-[10px] ${
                  e.level === "error" ? "bg-destructive/15 text-destructive" :
                  e.level === "warn" ? "bg-amber-500/15 text-amber-600" :
                  "bg-secondary"
                }`}>{e.level}</span>
                <span className="text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
                {e.source && <span className="text-muted-foreground">· {e.source}</span>}
              </div>
              <p className="mt-1 break-words font-medium">{e.msg}</p>
              {e.detail && <pre className="mt-1 whitespace-pre-wrap break-words text-[10.5px] text-muted-foreground">{e.detail}</pre>}
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
