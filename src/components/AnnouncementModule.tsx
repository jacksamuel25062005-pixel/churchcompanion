import { useMemo, useState } from "react";
import { Bell, Megaphone, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Card } from "./ui-bits";
import {
  useAnnouncements,
  filterAnnouncements,
  useUserRole,
  type Announcement,
} from "../lib/announcements";
import { useUnreadAnnouncements } from "../hooks/useUnreadAnnouncements";

function formatDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AudienceChip({ a }: { a: Announcement["audience"] }) {
  const label = a === "ChurchMembers" ? "सदस्य / Members" : "युवा / Youth Group";
  const bg = a === "ChurchMembers" ? "#2D6A4F" : "#1565C0";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ background: bg }}
    >
      {label}
    </span>
  );
}

function DetailSheet({ a, onClose }: { a: Announcement | null; onClose: () => void }) {
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        {a && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <AudienceChip a={a.audience} />
                <span className="text-xs text-muted-foreground">{formatDate(a.date)}</span>
              </div>
              <DialogTitle className="text-left text-lg leading-snug pt-2">{a.topic}</DialogTitle>
            </DialogHeader>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {a.body || "—"}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementModule({ layout = "list" }: { layout?: "chip" | "list" }) {
  const role = useUserRole();
  const { data } = useAnnouncements();
  const visible = useMemo(() => filterAnnouncements(data ?? [], role), [data, role]);
  const [open, setOpen] = useState<Announcement | null>(null);

  if (!visible.length) {
    return (
      <Card className="p-5 text-center">
        <Megaphone className="mx-auto h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          कोई घोषणा नहीं / No announcements
        </p>
      </Card>
    );
  }

  if (layout === "chip") {
    return (
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(visible[0])}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
        >
          <Megaphone className="h-4 w-4 brand-text shrink-0" />
          <span className="flex-1 truncate text-sm font-medium">{visible[0].topic}</span>
          <span className="text-[10px] text-muted-foreground">{formatDate(visible[0].date)}</span>
        </button>
        <DetailSheet a={open} onClose={() => setOpen(null)} />
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <ul className="divide-y">
          {visible.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setOpen(a)}
                className="tap-card flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent"
              >
                <Megaphone className="h-4 w-4 brand-text mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{a.topic}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <AudienceChip a={a.audience} />
                    <span className="text-[10px] text-muted-foreground">{formatDate(a.date)}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <DetailSheet a={open} onClose={() => setOpen(null)} />
    </>
  );
}

export function AnnouncementBell() {
  const role = useUserRole();
  const { data } = useAnnouncements();
  const visible = useMemo(() => filterAnnouncements(data ?? [], role), [data, role]);
  const { hasUnread, markAllRead } = useUnreadAnnouncements(visible);
  const [open, setOpen] = useState<Announcement | null>(null);

  const onTap = () => {
    if (!visible[0]) return;
    setOpen(visible[0]);
    markAllRead();
  };

  return (
    <>
      <button
        type="button"
        onClick={onTap}
        aria-label="Announcements"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
      >
        <Bell
          className={`h-[22px] w-[22px] brand-text ${hasUnread ? "bell-shake" : ""}`}
        />
        {hasUnread && (
          <span
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
            style={{ background: "#C62828" }}
          />
        )}
      </button>
      <DetailSheet a={open} onClose={() => setOpen(null)} />
    </>
  );
}

export { X as _X };
