import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { Card, BackButton } from "../components/ui-bits";
import { useT } from "../lib/i18n";
import { toast } from "sonner";
import { Shield, UserPlus } from "lucide-react";

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
          navigate({ to: "/admin/dashboard" });
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
      <div className="pt-4">
        <div className="grid grid-cols-2 rounded-xl bg-secondary p-1 text-sm font-medium">
          <button onClick={() => setTab("super")} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 ${tab === "super" ? "bg-card shadow" : ""}`}>
            <Shield className="h-4 w-4" /> {t("admin.super_login")}
          </button>
          <button onClick={() => setTab("admin")} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 ${tab === "admin" ? "bg-card shadow" : ""}`}>
            <UserPlus className="h-4 w-4" /> {t("admin.admin_login")}
          </button>
        </div>
        <div className="mt-4">
          {tab === "super" ? <LoginForm role="super" /> : <LoginForm role="admin" />}
        </div>
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
        navigate({ to: "/admin/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground mb-4">
        {role === "super"
          ? "Sign in as the Super Admin."
          : mode === "login"
            ? "Sign in if you are already an approved admin."
            : "Create an account and request admin access. The Super Admin must approve before you can sign in."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t("admin.email")}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="input" />
        </Field>
        <Field label={t("admin.password")}>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="input" />
        </Field>
        {role === "admin" && mode === "signup" && (
          <Field label={t("admin.request_reason")}>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input" placeholder="Why do you need admin access?" />
          </Field>
        )}
        <button disabled={submitting} className="w-full rounded-xl brand-bg py-2.5 text-sm font-medium disabled:opacity-50">
          {submitting ? "…" : mode === "login" ? t("admin.sign_in") : "Request access"}
        </button>
        {role === "admin" && (
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-xs text-muted-foreground underline"
          >
            {mode === "login" ? "Create account & request access" : "Have an approved account? Sign in"}
          </button>
        )}
      </form>
      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-border);background:var(--color-secondary);padding:0.65rem 0.85rem;font-size:0.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px var(--brand)}`}</style>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
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

  return (
    <AppShell title={t("admin.title")} left={<BackButton to="/" />} hideNav>
      <div className="pt-4 space-y-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="font-medium">{email}</p>
        </Card>

        {existing ? (
          <Card className="p-5">
            <p className="text-sm font-medium">Request status: <span className="brand-text uppercase">{existing.status}</span></p>
            {existing.status === "pending" && <p className="text-xs text-muted-foreground mt-1">Wait for an admin or the Super Admin to approve.</p>}
            {existing.status === "rejected" && <p className="text-xs text-muted-foreground mt-1">Your previous request was rejected. You can submit a new one below.</p>}
            {existing.status === "approved" && (
              <Link to="/admin/dashboard" className="mt-3 inline-flex rounded-xl brand-bg px-4 py-2 text-sm font-medium">Open dashboard</Link>
            )}
          </Card>
        ) : null}

        {(!existing || existing.status === "rejected") && (
          <Card className="p-5">
            <form onSubmit={submit} className="space-y-3">
              <Field label={t("admin.request_reason")}>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className="w-full rounded-xl border bg-secondary p-3 text-sm" required />
              </Field>
              <button disabled={loading} className="w-full rounded-xl brand-bg py-2.5 text-sm font-medium disabled:opacity-50">{t("admin.request_submit")}</button>
            </form>
          </Card>
        )}

        <button onClick={signOut} className="w-full text-xs text-muted-foreground underline">{t("admin.sign_out")}</button>
      </div>
    </AppShell>
  );
}
