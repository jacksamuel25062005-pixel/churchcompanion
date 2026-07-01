import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { useAdminGuard } from "../../lib/use-admin-guard";
import { useAllAnnouncements, type Announcement, type AnnouncementAudience } from "../../lib/announcements";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  component: ManagePage,
});

type FormState = {
  id: string | null;
  topic: string;
  date: string;
  body: string;
  audience: AnnouncementAudience;
};

const empty: FormState = {
  id: null,
  topic: "",
  date: new Date().toISOString().slice(0, 10),
  body: "",
  audience: "ChurchMembers",
};

function ManagePage() {
  const { checked } = useAdminGuard();
  const qc = useQueryClient();
  const { data, isLoading } = useAllAnnouncements();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => data ?? [], [data]);

  async function save(published: boolean) {
    if (!editing) return;
    if (!editing.topic.trim() || !editing.date) {
      toast.error("Topic and date are required");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        topic: editing.topic.trim(),
        date: editing.date,
        body: editing.body,
        audience: editing.audience,
        published,
      };
      if (editing.id) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcements")
          .insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
      toast.success(published ? "Published" : "Saved as draft");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("announcements").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  if (!checked) return null;

  return (
    <AppShell
      title="Announcements"
      left={
        <Link to="/admin/dashboard" className="-ml-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-accent">
          ‹ Back
        </Link>
      }
      hideNav
    >
      <div className="space-y-3 pt-4 pb-24">
        {isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : rows.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No announcements yet</Card>
        ) : (
          rows.map((a) => <Row key={a.id} a={a} onEdit={() => setEditing(toForm(a))} onDelete={() => setDeleteId(a.id)} />)
        )}
      </div>

      <button
        onClick={() => setEditing({ ...empty })}
        aria-label="New announcement"
        className="fixed bottom-6 right-5 z-40 grid h-14 w-14 place-items-center rounded-full brand-bg shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl glass-modal">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Topic">
                <input
                  value={editing.topic}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                  className="w-full rounded-xl border bg-secondary px-3 py-2 text-sm"
                  maxLength={200}
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  className="w-full rounded-xl border bg-secondary px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Body">
                <textarea
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={5}
                  className="w-full rounded-xl border bg-secondary px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Target">
                <div className="grid grid-cols-2 gap-2">
                  {(["ChurchMembers", "YouthGroup"] as AnnouncementAudience[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEditing({ ...editing, audience: v })}
                      className={`rounded-xl border py-2.5 text-sm font-medium ${
                        editing.audience === v ? "brand-bg brand-border" : "bg-card"
                      }`}
                    >
                      {v === "ChurchMembers" ? "Church Members" : "Youth Group"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setEditing(null)}
              className="rounded-xl border bg-card px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            {editing?.id && (
              <button
                disabled={saving}
                onClick={() => save(false)}
                className="rounded-xl border bg-card px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Save as Draft
              </button>
            )}
            <button
              disabled={saving}
              onClick={() => save(true)}
              className="rounded-xl brand-bg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "…" : "Publish"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function toForm(a: Announcement): FormState {
  return { id: a.id, topic: a.topic, date: a.date, body: a.body, audience: a.audience };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ a, onEdit, onDelete }: { a: Announcement; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{a.topic}</p>
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <span
            className="rounded-full px-2 py-0.5 font-semibold text-white"
            style={{ background: a.audience === "ChurchMembers" ? "#2D6A4F" : "#1565C0" }}
          >
            {a.audience === "ChurchMembers" ? "Members" : "Youth"}
          </span>
          <span
            className="rounded-full px-2 py-0.5 font-semibold"
            style={{
              background: a.published ? "#DCFCE7" : "#FEF3C7",
              color: a.published ? "#166534" : "#92400E",
            }}
          >
            {a.published ? "Published" : "Draft"}
          </span>
          <span className="text-muted-foreground">{a.date}</span>
        </div>
      </div>
      <button
        onClick={onEdit}
        aria-label="Edit"
        className="grid h-9 w-9 place-items-center rounded-lg hover:bg-accent"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </Card>
  );
}
