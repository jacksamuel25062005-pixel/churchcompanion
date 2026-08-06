import { AnimatePresence, motion } from "framer-motion";
import { Copy, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QUICK_EMOJIS } from "../../lib/chat";
import { haptic } from "../../lib/haptics";
import { cn } from "../../lib/utils";

export interface MessageActions {
  canEdit: boolean;
  canDelete: boolean;
  canReact: boolean;
}

interface Props {
  open: boolean;
  preview: string;
  actions: MessageActions;
  myReactions: string[];
  onClose: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

const SHEET_SPRING = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 };

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/** Material Design 3 style bottom sheet with the WhatsApp long-press actions. */
export function MessageActionSheet({
  open, preview, actions, myReactions, onClose, onReact, onEdit, onCopy, onDelete,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  const rows: Array<{ key: string; label: string; icon: typeof Copy; run: () => void; danger?: boolean }> = [];
  if (actions.canEdit) rows.push({ key: "edit", label: "Edit message", icon: Pencil, run: () => { haptic.light(); onEdit(); } });
  rows.push({ key: "copy", label: "Copy text", icon: Copy, run: () => { haptic.light(); onCopy(); } });
  if (actions.canDelete) {
    rows.push({ key: "delete", label: "Delete message", icon: Trash2, danger: true, run: () => { haptic.warning(); setConfirmDelete(true); } });
  }

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[90] bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
        )}
        {open && (
          <motion.div
            key="sheet"
            className="fixed inset-x-0 bottom-0 z-[91] flex justify-center px-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={SHEET_SPRING}
          >
            <div className="glass-strong w-full max-w-[min(100%,var(--app-max-w))] overflow-hidden rounded-[28px] p-2 pb-3 shadow-2xl">
              <div className="mx-auto mb-2 mt-1 h-1 w-9 rounded-full bg-muted-foreground/30" />

              {actions.canReact && (
                <div className="mb-2 flex items-center justify-between gap-1 rounded-full bg-card/60 px-2 py-1.5">
                  {QUICK_EMOJIS.map((e) => {
                    const active = myReactions.includes(e);
                    return (
                      <motion.button
                        key={e}
                        whileTap={{ scale: 0.82 }}
                        transition={{ type: "spring", stiffness: 520, damping: 26 }}
                        onClick={() => { haptic.light(); onReact(e); }}
                        aria-label={`React ${e}`}
                        className={cn(
                          "grid h-11 w-11 place-items-center rounded-full text-[22px] leading-none transition",
                          active && "bg-primary/20 ring-1 ring-primary/50",
                        )}
                      >
                        {e}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {preview && (
                <p className="mx-2 mb-1 line-clamp-2 text-xs text-muted-foreground">{preview}</p>
              )}

              <ul className="space-y-0.5">
                {rows.map((r) => (
                  <li key={r.key}>
                    <motion.button
                      whileTap={{ scale: 0.985 }}
                      onClick={r.run}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium transition",
                        "hover:bg-accent active:bg-accent",
                        r.danger && "text-destructive",
                      )}
                    >
                      <r.icon className="h-[18px] w-[18px]" />
                      {r.label}
                    </motion.button>
                  </li>
                ))}
                <li>
                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    onClick={onClose}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-[18px] w-[18px]" />
                    Cancel
                  </motion.button>
                </li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this message?"
        body="It will be removed for everyone in this chat. This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
      />
    </Portal>
  );
}

export function ConfirmDialog({
  open, title, body, confirmLabel = "Confirm", onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[95] bg-black/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={onCancel}
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              className="fixed inset-0 z-[96] grid place-items-center px-6"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
            >
              <div className="glass-strong w-full max-w-sm rounded-[28px] p-5 shadow-2xl">
                <h2 className="text-lg font-semibold">{title}</h2>
                {body && <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={onCancel}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { haptic.warning(); onConfirm(); }}
                    className="rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground"
                  >
                    {confirmLabel}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
