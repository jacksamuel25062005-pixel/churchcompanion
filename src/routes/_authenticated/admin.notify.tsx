import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { sendPushNotification } from "../../lib/notifications.functions";
import { useAdminGuard } from "../../lib/use-admin-guard";

export const Route = createFileRoute("/_authenticated/admin/notify")({
  component: NotifyPage,
});

function NotifyPage() {
  const { checked } = useAdminGuard();
  const send = useServerFn(sendPushNotification);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await send({ data: { title, message, url: url || undefined } });
      toast.success(`Sent to ${res.recipients ?? 0} device(s)`);
      setTitle(""); setMessage(""); setUrl("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setSending(false);
    }
  };

  if (!checked) return null;
  return (
    <AppShell title="Send notification" left={<Link to="/admin/dashboard" className="-ml-2 text-sm font-medium px-2 py-1.5 rounded-lg hover:bg-accent">‹ Back</Link>} hideNav>
      <div className="pt-4 space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Bell className="h-4 w-4" /> Push to all subscribers (OneSignal)
          </div>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" placeholder="Sunday service" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} maxLength={500} className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" placeholder="Today's songs are published." />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Link (optional)</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" className="mt-1 w-full rounded-xl border bg-secondary px-3 py-2 text-sm" placeholder="https://…" />
            </label>
            <button disabled={sending} className="w-full rounded-xl brand-bg py-3 text-sm font-semibold disabled:opacity-50">
              {sending ? "Sending…" : "Send notification"}
            </button>
          </form>
        </Card>
        <Card className="p-4 text-xs text-muted-foreground">
          Users must allow notifications on the app first (Settings → Notifications). Sent via OneSignal.
        </Card>
      </div>
    </AppShell>
  );
}
