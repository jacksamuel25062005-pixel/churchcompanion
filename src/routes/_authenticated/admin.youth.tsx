import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { broadcastYouthRoster } from "@/lib/chat";
import { toast } from "sonner";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/_authenticated/admin/youth")({
  component: YouthAdmin,
  head: () => ({
    meta: [
      { title: "Youth admin · Church Companion" },
      { name: "description", content: "Approve youth chat access requests and manage the approved phone list." },
      { property: "og:title", content: "Youth admin · Church Companion" },
      { property: "og:description", content: "Approve youth chat access requests and manage the approved phone list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "pending" | "approved" | "rejected" | "whitelist";
const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "whitelist", label: "Whitelist" },
];

interface RequestRow {
  id: string;
  phone_number: string;
  name: string;
  message: string | null;
  status: Tab;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}
interface WhitelistRow {
  id: string;
  phone_number: string;
  name: string;
  source: string;
  created_at: string;
}

const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 brand-ring";
const btn = "rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white active:scale-95 transition disabled:opacity-50";

function YouthAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [form, setForm] = useState({ name: "", phone: "" });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const requestsQ = useQuery({
    queryKey: ["youth-access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_access_requests" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RequestRow[];
    },
  });

  const whitelistQ = useQuery({
    queryKey: ["youth-whitelist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_phone_whitelist" as never)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as WhitelistRow[];
    },
  });

  const pendingCount = useMemo(
    () => (requestsQ.data ?? []).filter((r) => r.status === "pending").length,
    [requestsQ.data],
  );

  // Live toast + badge when a new request lands.
  useEffect(() => {
    const ch = supabase
      .channel("admin-youth-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "youth_access_requests" }, (payload) => {
        const row = payload.new as Partial<RequestRow> | null;
        if (payload.eventType === "INSERT" && row?.id && !seen.current.has(row.id)) {
          seen.current.add(row.id);
          toast.info(`New youth access request from ${row.name ?? "someone"}`);
        }
        void qc.invalidateQueries({ queryKey: ["youth-access-requests"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["youth-access-requests"] });
    void qc.invalidateQueries({ queryKey: ["youth-whitelist"] });
    broadcastYouthRoster();
  };

  const review = async (id: string, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt("Reason for rejection (optional)") ?? null;
    }
    const { error } = await supabase.rpc("youth_review_request" as never, {
      _id: id, _approve: approve, _reason: reason,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved" : "Rejected");
    refreshAll();
  };

  const addManual = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    const { error } = await supabase.from("youth_phone_whitelist" as never).insert({
      name: form.name.trim(), phone_number: form.phone.trim(), source: "manual",
    } as never);
    if (error) { toast.error(error.message); return; }
    setForm({ name: "", phone: "" });
    refreshAll();
  };

  const removeEntry = async (id: string) => {
    const { error } = await supabase.from("youth_phone_whitelist" as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refreshAll();
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const payload: { name: string; phone_number: string; source: string }[] = [];
    for (const line of rows) {
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      if (!parts.length) continue;
      if (/name/i.test(parts[0]) && /phone/i.test(parts[1] ?? "")) continue; // header
      const [a, b] = parts;
      const name = /\d/.test(a) && b ? b : a;
      const phone = /\d/.test(a) ? a : b;
      if (!phone || phone.replace(/\D/g, "").length < 10) continue;
      payload.push({ name: name || "Youth member", phone_number: phone, source: "csv" });
    }
    if (!payload.length) { toast.error("No valid rows found"); return; }
    const { error } = await supabase
      .from("youth_phone_whitelist" as never)
      .upsert(payload as never, { onConflict: "phone_number" });
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${payload.length} numbers`);
    refreshAll();
  };

  const exportCsv = () => {
    const rows = whitelistQ.data ?? [];
    const csv = ["name,phone_number", ...rows.map((r) => `"${r.name}","${r.phone_number}"`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "youth-whitelist.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const listFor = (status: Tab) => (requestsQ.data ?? []).filter((r) => r.status === status);

  return (
    <AppShell title="Youth admin" left={<BackButton to="/admin/dashboard" />}>
      <div className="mt-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95",
                tab === tb.key ? "bg-[var(--brand)] text-white border-transparent" : "text-muted-foreground",
              )}
            >
              {tb.label}
              {tb.key === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab !== "whitelist" && (
          <Card className="space-y-3 p-4">
            {listFor(tab).length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing here.</p>
            )}
            {listFor(tab).map((r) => (
              <div key={r.id} className="rounded-xl border p-3 text-xs">
                <p className="font-semibold">{r.name} · {r.phone_number}</p>
                {r.message && <p className="mt-1 text-muted-foreground">{r.message}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                  {r.rejection_reason && ` · reason: ${r.rejection_reason}`}
                </p>
                {r.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <button className={btn} onClick={() => void review(r.id, true)}>Accept</button>
                    <button
                      className="rounded-xl border border-destructive px-3 py-2 text-xs font-semibold text-destructive active:scale-95 transition"
                      onClick={() => void review(r.id, false)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}

        {tab === "whitelist" && (
          <Card className="space-y-3 p-4">
            <h2 className="font-display text-base font-bold">Approved numbers</h2>
            <div className="flex gap-2">
              <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={input} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <button className={btn} onClick={() => void addManual()}>Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
              <button className={btn} onClick={() => fileRef.current?.click()}>Bulk upload CSV</button>
              <button className={btn} onClick={exportCsv}>Export CSV</button>
            </div>
            <ul className="space-y-1 text-xs">
              {(whitelistQ.data ?? []).map((y) => (
                <li key={y.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span>{y.name} · {y.phone_number} <span className="text-muted-foreground">({y.source})</span></span>
                  <button className="text-destructive" onClick={() => void removeEntry(y.id)}>Remove</button>
                </li>
              ))}
              {(whitelistQ.data ?? []).length === 0 && (
                <li className="text-muted-foreground">No approved numbers yet.</li>
              )}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
