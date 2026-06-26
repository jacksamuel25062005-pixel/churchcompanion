import { useState } from "react";
import { Download, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, useIsDownloaded } from "../lib/offline";

interface Props {
  storageKey: string;
  label?: string;
  onDownload: () => Promise<void>;
  onRemove?: () => void;
  className?: string;
}

export function OfflineButton({ storageKey, label = "Download for offline", onDownload, onRemove, className = "" }: Props) {
  const [busy, setBusy] = useState(false);
  const entry = useIsDownloaded(storageKey);

  const handle = async () => {
    if (busy) return;
    if (entry) {
      onRemove?.();
      toast.success("Removed offline copy");
      return;
    }
    setBusy(true);
    try {
      await onDownload();
      toast.success("Available offline");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      className={`tap-card inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
        entry ? "brand-bg brand-border" : "bg-card"
      } ${className}`}
      title={entry ? `Saved · ${formatBytes(entry.bytes)}` : label}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : entry ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Saved · {formatBytes(entry.bytes)}</span>
          <Trash2 className="h-3.5 w-3.5 opacity-70" />
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
