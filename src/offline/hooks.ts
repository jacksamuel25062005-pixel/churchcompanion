// React hooks the UI uses to read offline/sync/upload state without changing
// existing components. All hooks are SSR-safe (return defaults during SSR).

import { useEffect, useState } from "react";
import { getSyncState, subscribeSync, type SyncState } from "./sync/engine";
import { getUploadJobs, subscribeUploads } from "./uploads/queue";
import type { UploadRow } from "./db";

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

interface ConnectivityInfo {
  online: boolean;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

export function useConnectivity(): ConnectivityInfo {
  const online = useOnline();
  const [info, setInfo] = useState<ConnectivityInfo>({ online });
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        rtt?: number;
        downlink?: number;
        saveData?: boolean;
        addEventListener?: (t: string, cb: () => void) => void;
        removeEventListener?: (t: string, cb: () => void) => void;
      };
    };
    const apply = () => {
      const c = nav.connection;
      setInfo({
        online: navigator.onLine,
        effectiveType: c?.effectiveType,
        rtt: c?.rtt,
        downlink: c?.downlink,
        saveData: c?.saveData,
      });
    };
    apply();
    nav.connection?.addEventListener?.("change", apply);
    return () => nav.connection?.removeEventListener?.("change", apply);
  }, [online]);
  return info;
}

export function useSync(): SyncState {
  const [s, setS] = useState<SyncState>(getSyncState());
  useEffect(() => subscribeSync(setS), []);
  return s;
}

export function useUploadQueue(): UploadRow[] {
  const [jobs, setJobs] = useState<UploadRow[]>(getUploadJobs());
  useEffect(() => subscribeUploads(setJobs), []);
  return jobs;
}

export function useBackgroundSync(): { supported: boolean } {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator &&
      "SyncManager" in window;
    setSupported(ok);
  }, []);
  return { supported };
}

export function useOffline(): boolean {
  return !useOnline();
}
