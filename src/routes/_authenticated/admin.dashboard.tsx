import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton } from "../../components/ui-bits";
import {
  Upload, ListMusic, UserCheck, LogOut, Shield, Database, Bell, Megaphone,
  BookImage, History, MessagesSquare, KeyRound,
} from "lucide-react";
import { SettingsGroup, SettingsLinkRow, SettingsButtonRow, RowIcon } from "../../components/settings/SettingsUI";
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

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin", replace: true });
    toast.success("Signed out");
  };

  return (
    <AppShell title="Admin" left={<BackButton to="/" />} hideNav>
      <div className="space-y-6 pt-4">
        {/* Identity hero */}
        <section className="glass overflow-hidden rounded-[24px]">
          <div className="brand-bg px-5 py-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
              <Shield className="h-3 w-3" /> {role === "super_admin" ? "Super Admin" : "Admin"}
            </span>
            <p className="mt-2 truncate text-[22px] font-semibold leading-tight tracking-tight">
              {adminDisplayName({ role, displayName, email })}
            </p>
            {email && <p className="mt-0.5 truncate text-[12px] opacity-80">{email}</p>}
          </div>
          <div className="grid grid-cols-3 divide-x divide-border/50">
            <Stat label="Songs" value={stats?.songs} loading={stats === null} />
            <Stat label="Sections" value={stats?.sections} loading={stats === null} />
            <Stat label="Pending" value={stats?.pending} loading={stats === null} />
          </div>
        </section>

        <SettingsGroup label="Content">
          <SettingsLinkRow
            to="/admin/upload"
            icon={<RowIcon><Upload /></RowIcon>}
            title="Upload content"
            subtitle="PDF, DOCX, MD or TXT → parse → publish"
          />
          <SettingsLinkRow
            to="/admin/book-import"
            icon={<RowIcon><BookImage /></RowIcon>}
            title="Book image import"
            subtitle="Lord's Supper · Ashaya Rabbani · Prata Sayan"
          />
          <SettingsLinkRow
            to="/admin/manage"
            icon={<RowIcon><Database /></RowIcon>}
            title="Manage content"
            subtitle="Edit or delete songs & book sections"
          />
          <SettingsLinkRow
            to="/admin/today"
            icon={<RowIcon><ListMusic /></RowIcon>}
            title="Today's Songs"
            subtitle="Pick what users see today"
          />
        </SettingsGroup>

        <SettingsGroup label="Communication">
          <SettingsLinkRow
            to="/admin/notify"
            icon={<RowIcon><Bell /></RowIcon>}
            title="Send notification"
            subtitle="Push to all subscribers"
          />
          <SettingsLinkRow
            to="/admin/announcements"
            icon={<RowIcon><Megaphone /></RowIcon>}
            title="Announcements"
            subtitle="Post to church members or youth group"
          />
          <SettingsLinkRow
            to="/admin/chat"
            icon={<RowIcon><MessagesSquare /></RowIcon>}
            title="Chat moderation"
            subtitle="Reports & mutes"
          />
          {role === "super_admin" && (
            <SettingsLinkRow
              to="/admin/congregation"
              icon={<RowIcon><Users /></RowIcon>}
              title="Manage congregation chat"
              subtitle="Edit or remove chat members"
            />
          )}
        </SettingsGroup>


        <SettingsGroup label="People & access">
          <SettingsLinkRow
            to="/admin/requests"
            icon={<RowIcon><UserCheck /></RowIcon>}
            title="Admin requests"
            subtitle="Approve or reject"
            trailing={stats && stats.pending > 0 ? <Badge>{stats.pending}</Badge> : undefined}
          />
          <SettingsLinkRow
            to="/admin/youth"
            icon={<RowIcon><UserCheck /></RowIcon>}
            title="Youth admin"
            subtitle="Access requests & approved numbers"
          />
          <SettingsLinkRow
            to="/admin/audit"
            icon={<RowIcon tone="muted"><History /></RowIcon>}
            title="Change history"
            subtitle="Who changed songs, books & Today's Songs"
          />
          <SettingsLinkRow
            to="/admin/security"
            icon={<RowIcon tone="muted"><KeyRound /></RowIcon>}
            title="Security"
            subtitle="Change password & sign out everywhere"
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsButtonRow
            onClick={signOut}
            icon={<RowIcon tone="danger"><LogOut /></RowIcon>}
            title="Sign out"
            subtitle="End this admin session on this device"
          />
        </SettingsGroup>
      </div>
    </AppShell>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
      {children}
    </span>
  );
}

function Stat({ label, value, loading }: { label: string; value?: number; loading?: boolean }) {
  return (
    <div className="px-3 py-3.5 text-center">
      {loading ? (
        <div className="mx-auto h-7 w-10 animate-pulse rounded-md bg-muted/60" />
      ) : (
        <p className="text-[22px] font-bold tabular-nums leading-none">{value ?? 0}</p>
      )}
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}
