import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Pencil, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../../components/AppShell";
import { BackButton } from "../../components/ui-bits";
import { SettingsGroup, RowIcon } from "../../components/settings/SettingsUI";
import { ConfirmDialog } from "../../components/chat/MessageActionSheet";
import {
  listCongregationMembers,
  removeCongregationMember,
  updateCongregationMember,
  type CongregationMember,
} from "../../lib/chat";
import { haptic } from "../../lib/haptics";
import { useIsSuperAdmin } from "../../lib/use-admin";

export const Route = createFileRoute("/_authenticated/admin/congregation")({
  component: ManageCongregation,
  head: () => ({
    meta: [
      { title: "Manage congregation chat · Church Companion" },
      { name: "description", content: "Super admin tools to edit or remove congregation chat members." },
      { property: "og:title", content: "Manage congregation chat · Church Companion" },
      { property: "og:description", content: "Super admin tools to edit or remove congregation chat members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ManageCongregation() {
  const qc = useQueryClient();
  const isSuper = useIsSuperAdmin();
  const [q, setQ] = useState("");
  const [editRow, setEditRow] = useState<CongregationMember | null>(null);
  const [editName, setEditName] = useState("");
  const [removeRow, setRemoveRow] = useState<CongregationMember | null>(null);

  useEffect(() => { if (editRow) setEditName(editRow.name); }, [editRow]);

  const membersQ = useQuery({
    queryKey: ["congregation-members"],
    queryFn: listCongregationMembers,
  });

  const saveM = useMutation({
    mutationFn: (v: { phone: string; name: string }) => updateCongregationMember(v.phone, v.name),
    onSuccess: () => {
      haptic.success();
      toast.success("Member updated");
      setEditRow(null);
      void qc.invalidateQueries({ queryKey: ["congregation-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (phone: string) => removeCongregationMember(phone),
    onSuccess: () => {
      haptic.success();
      toast.success("Member removed from the chat");
      setRemoveRow(null);
      void qc.invalidateQueries({ queryKey: ["congregation-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = membersQ.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((m) => m.name.toLowerCase().includes(term) || m.phone_number.includes(term));
  }, [membersQ.data, q]);

  return (
    <AppShell title="Congregation chat" left={<BackButton to="/admin/dashboard" />} hideNav>
      <div className="space-y-5 pt-4">
        <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
        </div>

        {!isSuper && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            You can view members, but only a Super Admin can edit or remove them.
          </p>
        )}

        <SettingsGroup label={`Members (${rows.length})`}>
          {membersQ.isLoading && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!membersQ.isLoading && rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No members found.</p>
          )}
          {rows.map((m) => (
            <div key={m.phone_number} className="flex items-center gap-3 px-4 py-3.5">
              <RowIcon><UserRound /></RowIcon>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-[15px] font-medium leading-tight">
                  {m.name}
                  {m.is_online && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {m.phone_number} · {m.message_count} messages
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                disabled={!isSuper}
                onClick={() => { haptic.light(); setEditRow(m); }}
                aria-label={`Edit ${m.name}`}
                data-icon-button
                className="hit-target grid h-9 w-9 place-items-center rounded-full transition-colors duration-200 hover:bg-accent disabled:opacity-30"
              >
                <Pencil className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                disabled={!isSuper}
                onClick={() => { haptic.warning(); setRemoveRow(m); }}
                aria-label={`Remove ${m.name}`}
                data-icon-button
                className="hit-target grid h-9 w-9 place-items-center rounded-full text-destructive transition-colors duration-200 hover:bg-destructive/10 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            </div>
          ))}
        </SettingsGroup>
      </div>

      {/* Edit member */}
      {editRow && (
        <div className="fixed inset-0 z-[95] grid place-items-center px-6">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/60"
            onClick={() => setEditRow(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            className="glass-strong relative w-full max-w-sm rounded-[28px] p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold">Edit member</h2>
            <p className="mt-1 text-sm text-muted-foreground">{editRow.phone_number}</p>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={50}
              placeholder="Display name"
              className="mt-4 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditRow(null)}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => saveM.mutate({ phone: editRow.phone_number, name: editName })}
                disabled={saveM.isPending || editName.trim().length < 2}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {saveM.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmDialog
        open={!!removeRow}
        title={`Remove ${removeRow?.name ?? ""}?`}
        body="They will be removed from the congregation chat and all of their messages will be deleted. This cannot be undone."
        confirmLabel="Remove"
        onCancel={() => setRemoveRow(null)}
        onConfirm={() => removeRow && removeM.mutate(removeRow.phone_number)}
      />
    </AppShell>
  );
}
