import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card, BackButton } from "../../components/ui-bits";
import { Upload, ListMusic, UserCheck, LogOut, Shield, Database, Bell, Megaphone, BookImage } from "lucide-react";
import { adminDisplayName } from "@/lib/admin-name";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [stats, setStats] = useState<{ songs: number; sections: number; pending: number } | null>(null);


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/admin", replace: true }); return; }
      setEmail(u.user.email ?? "");
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("display_name, email").eq("id", u.user.id).maybeSingle(),
      ]);
      const r = (roles ?? []).map((x) => x.role);
      if (!r.includes("admin") && !r.includes("super_admin")) { navigate({ to: "/admin", replace: true }); return; }
      setRole(r.includes("super_admin") ? "super_admin" : "admin");
      setDisplayName(profile?.display_name ?? "");

      const [{ count: songs }, { count: sections }, { count: pending }] = await Promise.all([
        supabase.from("songs").select("*", { count: "exact", head: true }),
        supabase.from("book_sections").select("*", { count: "exact", head: true }),
        supabase.from("admin_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setStats({ songs: songs ?? 0, sections: sections ?? 0, pending: pending ?? 0 });
    })();
  }, [navigate]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/admin", replace: true }); toast.success("Signed out"); };

  return (
    <AppShell title="Admin" left={<BackButton to="/" />} hideNav>
      <div className="pt-4 space-y-4">
        <Card className="p-5 brand-bg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
            <Shield className="h-3.5 w-3.5" /> {role === "super_admin" ? "Super Admin" : "Admin"}
          </div>
          <p className="mt-1 text-xl font-semibold tracking-tight">
            {adminDisplayName({ role, displayName, email })}
          </p>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Songs" value={stats?.songs} loading={stats === null} />
          <Stat label="Sections" value={stats?.sections} loading={stats === null} />
          <Stat label="Pending" value={stats?.pending} loading={stats === null} />
        </div>

        <div className="space-y-2">
          <NavTile to="/admin/upload" icon={<Upload className="h-5 w-5" />} title="Upload content" subtitle="PDF, DOCX or TXT → parse → publish" />
          <NavTile to="/admin/book-import" icon={<BookImage className="h-5 w-5" />} title="Book image import" subtitle="Lord's Supper · Ashaya Rabbani · Prata Sayan" />
          <NavTile to="/admin/manage" icon={<Database className="h-5 w-5" />} title="Manage content" subtitle="Edit or delete songs & book sections" />
          <NavTile to="/admin/today" icon={<ListMusic className="h-5 w-5" />} title="Today's Songs" subtitle="Pick what users see today" />
          <NavTile to="/admin/notify" icon={<Bell className="h-5 w-5" />} title="Send notification" subtitle="Push to all subscribers (OneSignal)" />
          <NavTile to="/admin/announcements" icon={<Megaphone className="h-5 w-5" />} title="Announcements" subtitle="Post to church members or youth group" />
          <NavTile to="/admin/requests" icon={<UserCheck className="h-5 w-5" />} title="Admin requests" subtitle="Approve or reject" />
        </div>

        <button
          onClick={signOut}
          className="tap-card focus-ring w-full inline-flex items-center justify-center gap-2 rounded-xl glass-chip py-3 min-h-11 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, loading }: { label: string; value?: number; loading?: boolean }) {
  return (
    <Card className="p-4 text-center">
      {loading ? (
        <div className="mx-auto h-7 w-10 rounded-md bg-muted/60 animate-pulse" />
      ) : (
        <p className="text-2xl font-bold tabular-nums">{value ?? 0}</p>
      )}
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </Card>
  );
}


function NavTile({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link to={to as any} className="tap-card flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-accent">
      <div className="brand-bg rounded-xl p-2.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
    </Link>
  );
}
