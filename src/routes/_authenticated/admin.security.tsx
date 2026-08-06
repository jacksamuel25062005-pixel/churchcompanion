import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton } from "../../components/ui-bits";
import { SettingsGroup, SettingsRow, SettingsButtonRow, RowIcon } from "../../components/settings/SettingsUI";
import { toast } from "sonner";
import { ShieldCheck, LogOut } from "lucide-react";
import { PasswordField, passwordScore, scoreLabel } from "@/components/security/PasswordField";

export const Route = createFileRoute("/_authenticated/admin/security")({
  component: AdminSecurity,
});

function AdminSecurity() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/admin", replace: true }); return; }
      setEmail(data.user.email ?? "");
    })();
  }, [navigate]);

  const score = passwordScore(next);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { toast.error("New passwords don't match"); return; }
    if (score < 3) { toast.error("Please choose a stronger password"); return; }
    if (next === current) { toast.error("New password must be different"); return; }
    setSaving(true);
    try {
      // Re-authenticate with the current password before allowing a change.
      const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: current });
      if (reauth) throw new Error("Current password is incorrect");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      toast.success("Password changed — sign in again with your new password");
      await supabase.auth.signOut();
      navigate({ to: "/admin", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not change password");
    } finally {
      setSaving(false);
    }
  };

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Signed out on all devices");
    navigate({ to: "/admin", replace: true });
  };

  return (
    <AppShell title="Security" left={<BackButton to="/admin/dashboard" />} hideNav>
      <div className="space-y-6 pt-4">
        <SettingsGroup label="Account">
          <SettingsRow
            icon={<RowIcon><ShieldCheck /></RowIcon>}
            title="Change password"
            subtitle={email ? `Signed in as ${email}` : "Signed in"}
          />
          <form onSubmit={submit} className="space-y-3 px-4 pb-5 pt-1">
            <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" showMeter={false} />
            <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" />
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" showMeter={false} />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Strength: {scoreLabel(score)} · use 12+ characters with a mix of cases, numbers and symbols.
            </p>
            <button
              disabled={saving}
              className="tap-card focus-ring min-h-11 w-full rounded-full brand-bg text-[14px] font-semibold elev-1 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>
        </SettingsGroup>

        <SettingsGroup label="Sessions" hint="Lost a device? Sign out of every device where this account is signed in.">
          <SettingsButtonRow
            onClick={signOutEverywhere}
            icon={<RowIcon tone="danger"><LogOut /></RowIcon>}
            title="Sign out everywhere"
            subtitle="Ends every active session for this account"
          />
        </SettingsGroup>
      </div>
    </AppShell>
  );
}
