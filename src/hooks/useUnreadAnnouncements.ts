import { useEffect, useState } from "react";
import type { Announcement } from "../lib/announcements";

const KEY = "cc_last_read_announcement_id";

export function useUnreadAnnouncements(announcements: Announcement[]) {
  const [lastRead, setLastRead] = useState<string | null>(null);
  useEffect(() => {
    try { setLastRead(localStorage.getItem(KEY)); } catch { /* noop */ }
  }, []);
  const hasUnread = announcements.length > 0 && announcements[0].id !== lastRead;
  function markAllRead() {
    if (!announcements[0]) return;
    try { localStorage.setItem(KEY, announcements[0].id); } catch { /* noop */ }
    setLastRead(announcements[0].id);
  }
  return { hasUnread, markAllRead };
}
