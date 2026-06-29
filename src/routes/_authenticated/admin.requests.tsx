import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { toast } from "sonner";
import { useAdminGuard } from "../../lib/use-admin-guard";
import { firstNameFrom } from "@/lib/admin-name";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  component: RequestsPage,
});

interface Req {
  id: string;
  user_id: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profile?: { email: string | null; display_name: string | null } | null;
}

function RequestsPage() {
  const { checked } = useAdminGuard();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_requests")
      .select("id, user_id, reason, status, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const reqs = (data ?? []) as Req[];
    if (reqs.length) {
      const ids = Array.from(new Set(reqs.map((r) => r.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id, email, display_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      reqs.forEach((r) => { r.profile = map.get(r.user_id) ?? null; });
    }
    setItems(reqs);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const decide = async (r: Req, status: "approved" | "rejected") => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_requests")
      .update({ status, decided_by: u.user?.id, decided_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success(`Request ${status}`); load(); }
  };

  if (!checked) return null;
  return (
    <AppShell title="Admin requests" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          items.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {firstNameFrom({ displayName: r.profile?.display_name, email: r.profile?.email }) || r.user_id.slice(0, 8)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  r.status === "pending" ? "bg-secondary" : r.status === "approved" ? "brand-bg" : "bg-destructive text-destructive-foreground"
                }`}>{r.status}</span>
              </div>
              {r.reason && <p className="mt-2 text-sm">{r.reason}</p>}
              {r.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decide(r, "approved")} className="flex-1 rounded-lg brand-bg py-2 text-sm font-medium">Approve</button>
                  <button onClick={() => decide(r, "rejected")} className="flex-1 rounded-lg border py-2 text-sm font-medium">Reject</button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
