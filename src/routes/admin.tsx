import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { BackButton } from "../components/ui-bits";
import { SettingsGroup, SettingsRow, RowIcon, Segmented } from "../components/settings/SettingsUI";
import { useT } from "../lib/i18n";
import { toast } from "sonner";
import { Shield, UserPlus } from "lucide-react";
import { firstNameFrom } from "@/lib/admin-name";
import { PasswordField } from "@/components/security/PasswordField";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Church Companion" }] }),
  component: AdminGate,
});

type Tab = "super" | "admin";

function AdminGate() {
  const { t } = useT();
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        // verify role
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
        if (isAdmin) {
          navigate({ to: "/admin/dashboard", replace: true });
          return;
        }
        setUser({ id: data.user.id, email: data.user.email });
      }
      setChecking(false);
    })();
    return () => { active = false; };
  }, [navigate]);

  if (checking) {
    return <AppShell title={t("admin.title")} left={<BackButton to="/" />}><p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p></AppShell>;
  }

  if (user) {
    return <RequestAdminAccess email={user.email ?? ""} userId={user.id} />;
  }

  return <AdminTabs />;
}

function AdminTabs() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("super");
  return (
    <AppShell title={t("admin.title")} left={<BackButton to="/" />} hideNav>
      <div className="space-y-6 pt-4">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-3xl brand-bg elev-1">
            <Shield className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">Admin access</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Sign in to manage church content</p>
          </div>
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          ariaLabel="Admin login type"
          options={[
            { value: "super", label: <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> {t("admin.super_login")}</span> },
            { value: "admin", label: <span className="inline-flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" /> {t("admin.admin_login")}</span> },
          ]}
        />

        {tab === "super" ? <LoginForm role="super" /> : <LoginForm role="admin" />}
      </div>
    </AppShell>
  );
}

function LoginForm({ role }: { role: "super" | "admin" }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const sendReset = async () => {
    if (!email.trim()) { toast.error("Enter your email first"); return; }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    // Never reveal whether an account exists for this address.
    if (error && !/rate/i.test(error.message)) toast.success("If that email has an account, a reset link is on its way.");
    else if (error) toast.error(error.message);
    else toast.success("If that email has an account, a reset link is on its way.");
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        // Create the account, file an admin request, then sign the user OUT.
        // They cannot log in again until the Super Admin approves them.
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        const newUserId = signUpData.user?.id;
        if (newUserId) {
          await supabase.from("admin_requests").insert({
            user_id: newUserId,
            reason: reason.trim() || "Requesting admin access",
          });
        }
        await supabase.auth.signOut();
        toast.success("Request submitted. You can sign in after the Super Admin approves your account.");
        setMode("login");
        setReason("");
        setPassword("");
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Gate: only users with an approved role may stay signed in.
        const uid = signInData.user?.id;
        if (!uid) throw new Error("Sign-in failed");
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
        if (!isAdmin) {
          await supabase.auth.signOut();
          toast.error("Your account is pending Super Admin approval. You'll be able to sign in once approved.");
          return;
        }
        toast.success("Signed in");
        navigate({ to: "/admin/dashboard", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const hint =
    role === "super"
      ? "Sign in as the Super Admin."
      : mode === "login"
        ? "Sign in if you are already an approved admin."
        : "Create an account and request admin access. The Super Admin must approve before you can sign in.";

  return (
    <SettingsGroup label={mode === "login" ? "Sign in" : "Request access"} hint={hint}>
      <form onSubmit={submit} className="space-y-3.5 p-4">
        <Field label={t("admin.email")}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="input" />
        </Field>
        <PasswordField
          label={t("admin.password")}
          value={password}
          onChange={setPassword}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {role === "admin" && mode === "signup" && (
          <Field label={t("admin.request_reason")}>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input" placeholder="Why do you need admin access?" />
          </Field>
        )}
        <button
          disabled={submitting}
          className="tap-card focus-ring min-h-11 w-full rounded-full brand-bg text-[14px] font-semibold elev-1 disabled:opacity-50"
        >
          {submitting ? "…" : mode === "login" ? t("admin.sign_in") : "Request access"}
        </button>
        <div className="flex flex-col items-center gap-2 pt-0.5">
          {mode === "login" && (
            <button
              type="button"
              onClick={sendReset}
              disabled={sendingReset}
              className="focus-ring rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              {sendingReset ? "Sending reset link…" : "Forgot password?"}
            </button>
          )}
          {role === "admin" && (
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="focus-ring rounded-full px-2 py-1 text-[12px] font-semibold brand-text underline-offset-4 hover:underline"
            >
              {mode === "login" ? "Create account & request access" : "Have an approved account? Sign in"}
            </button>
          )}
        </div>
      </form>
      <style>{`.input{width:100%;border-radius:0.9rem;border:1px solid var(--color-border);background:var(--color-secondary);padding:0.7rem 0.9rem;font-size:0.9rem;outline:none}.input:focus{box-shadow:0 0 0 2px var(--brand)}`}</style>
    </SettingsGroup>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function RequestAdminAccess({ email, userId }: { email: string; userId: string }) {
  const { t } = useT();
  const [reason, setReason] = useState("");
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
      setExisting(data?.[0] ?? null);
    })();
  }, [userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("admin_requests").insert({ user_id: userId, reason });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Request submitted");
      setExisting({ status: "pending", reason, created_at: new Date().toISOString() });
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.reload(); };

  const statusTone =
    existing?.status === "approved" ? "brand" : existing?.status === "rejected" ? "danger" : "muted";

  return (
    <AppShell title={t("admin.title")} left={<BackButton to="/" />} hideNav>
      <div className="space-y-6 pt-4">
        <SettingsGroup label="Account">
          <SettingsRow
            icon={<RowIcon><UserPlus /></RowIcon>}
            title={firstNameFrom({ email })}
            subtitle={email}
          />
        </SettingsGroup>

        {existing ? (
          <SettingsGroup
            label="Request status"
            hint={
              existing.status === "pending"
                ? "Wait for an admin or the Super Admin to approve."
                : existing.status === "rejected"
                  ? "Your previous request was rejected. You can submit a new one below."
                  : undefined
            }
          >
            <SettingsRow
              icon={<RowIcon tone={statusTone as any}><Shield /></RowIcon>}
              title={<span className="capitalize">{existing.status}</span>}
              subtitle={existing.created_at ? new Date(existing.created_at).toLocaleString() : undefined}
            />
            {existing.status === "approved" && (
              <div className="p-4">
                <Link
                  to="/admin/dashboard"
                  className="tap-card focus-ring flex min-h-11 items-center justify-center rounded-full brand-bg text-[14px] font-semibold elev-1"
                >
                  Open dashboard
                </Link>
              </div>
            )}
          </SettingsGroup>
        ) : null}

        {(!existing || existing.status === "rejected") && (
          <SettingsGroup label="Request admin access">
            <form onSubmit={submit} className="space-y-3.5 p-4">
              <Field label={t("admin.request_reason")}>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  required
                  className="w-full rounded-[0.9rem] border border-border bg-secondary p-3 text-sm outline-none focus:shadow-[0_0_0_2px_var(--brand)]"
                />
              </Field>
              <button
                disabled={loading}
                className="tap-card focus-ring min-h-11 w-full rounded-full brand-bg text-[14px] font-semibold elev-1 disabled:opacity-50"
              >
                {t("admin.request_submit")}
              </button>
            </form>
          </SettingsGroup>
        )}

        <button
          onClick={signOut}
          className="focus-ring mx-auto block rounded-full px-3 py-1.5 text-[12px] font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("admin.sign_out")}
        </button>
      </div>
    </AppShell>
  );
}
