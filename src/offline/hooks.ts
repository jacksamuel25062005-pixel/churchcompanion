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
  /** Human-friendly label: "5G", "4G+", "4G", "3G", "2G", "Wi-Fi", "Ethernet", "Offline". */
  label?: string;
  /** Raw connection type ('cellular' | 'wifi' | 'ethernet' | 'wimax' | 'bluetooth' | ...). */
  type?: string;
  rtt?: number;
  downlink?: number;
  /** Reported max downlink (Mbps) when available. */
  downlinkMax?: number;
  saveData?: boolean;
}

/**
 * Derives a coarse network label. The Network Information API caps
 * `effectiveType` at "4g" — there is no standard "5g" value — so we infer
 * 5G / 4G+ from downlink + RTT when the underlying transport is cellular.
 */
function deriveLabel(c: {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  downlinkMax?: number;
  rtt?: number;
}, online: boolean): string {
  if (!online) return "Offline";
  const dl = c.downlink ?? 0;
  const dlMax = c.downlinkMax ?? 0;
  const rtt = c.rtt ?? Infinity;
  const isCellular = c.type === "cellular" || (!c.type && !!c.effectiveType);
  if (isCellular) {
    // 5G NR: typically >50 Mbps with <60ms RTT, or a very high reported max.
    if ((dl >= 50 && rtt <= 60) || dlMax >= 100) return "5G";
    // 4G+ / LTE-A: strong LTE well above the baseline 4g bucket.
    if (c.effectiveType === "4g" && dl >= 20 && rtt <= 100) return "4G+";
    if (c.effectiveType === "4g") return "4G";
    if (c.effectiveType === "3g") return "3G";
    if (c.effectiveType === "2g") return "2G";
    if (c.effectiveType === "slow-2g") return "Slow 2G";
    return "Cellular";
  }
  if (c.type === "wifi") return "Wi-Fi";
  if (c.type === "ethernet") return "Ethernet";
  if (c.type === "wimax") return "WiMAX";
  if (c.type === "bluetooth") return "Bluetooth";
  if (c.effectiveType) return c.effectiveType.toUpperCase();
  return "Online";
}

export function useConnectivity(): ConnectivityInfo {
  const online = useOnline();
  const [info, setInfo] = useState<ConnectivityInfo>({ online });
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      connection?: {
        type?: string;
        effectiveType?: string;
        rtt?: number;
        downlink?: number;
        downlinkMax?: number;
        saveData?: boolean;
        addEventListener?: (t: string, cb: () => void) => void;
        removeEventListener?: (t: string, cb: () => void) => void;
      };
    };
    const apply = () => {
      const c = nav.connection ?? {};
      const isOnline = navigator.onLine;
      setInfo({
        online: isOnline,
        type: c.type,
        effectiveType: c.effectiveType,
        rtt: c.rtt,
        downlink: c.downlink,
        downlinkMax: c.downlinkMax,
        saveData: c.saveData,
        label: deriveLabel(c, isOnline),
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
