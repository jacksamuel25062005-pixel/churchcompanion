import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card, BackButton } from "../components/ui-bits";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PasswordField, passwordScore, scoreLabel } from "@/components/security/PasswordField";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Church Companion" },
      { name: "description", content: "Set a new password for your Church Companion admin account." },
      { property: "og:title", content: "Reset password — Church Companion" },
      { property: "og:description", content: "Set a new password for your Church Companion admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery link and emits PASSWORD_RECOVERY / SIGNED_IN.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) { setHasSession(true); setReady(true); }
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
      setReady(true);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  const score = passwordScore(pw);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) { toast.error("Passwords don't match"); return; }
    if (score < 3) { toast.error("Please choose a stronger password"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — please sign in again");
    await supabase.auth.signOut();
    navigate({ to: "/admin", replace: true });
  };

  return (
    <AppShell title="Reset password" left={<BackButton to="/admin" />} hideNav>
      <div className="pt-4 space-y-4">
        <Card className="p-5">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Checking your reset link…</p>
          ) : !hasSession ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" /> Link expired or invalid</div>
              <p className="text-xs text-muted-foreground">
                Open the most recent password reset email on this device, or request a new link from the admin sign-in screen.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Choose a new password</div>
              <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" />
              <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              <p className="text-[11px] text-muted-foreground">Strength: {scoreLabel(score)}</p>
              <button disabled={saving} className="tap-card focus-ring w-full rounded-xl brand-bg py-2.5 text-sm font-medium disabled:opacity-50">
                {saving ? "Saving…" : "Update password"}
              </button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
