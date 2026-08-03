import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { unreadCount, getYouthIdentity } from "@/lib/chat";

/** Global floating chat entry point, anchored just above the bottom dock. */
export function ChatFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const cong = await unreadCount("congregation");
      const youth = getYouthIdentity() ? await unreadCount("youth") : 0;
      if (!cancelled) setUnread(cong + youth);
    };
    void refresh();
    const ch = supabase
      .channel("chat-fab-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void refresh())
      .subscribe();
    const iv = window.setInterval(refresh, 30000);
    return () => { cancelled = true; window.clearInterval(iv); void supabase.removeChannel(ch); };
  }, [pathname]);

  if (pathname.startsWith("/chat")) return null;

  return (
    <motion.div
      className="fixed z-40"
      style={{
        right: "max(calc(var(--app-gutter) + var(--sar)), calc(var(--sar) + 0.75rem))",
        /* Sits above the dock, which itself already clears the gesture bar /
           home indicator via --sab. Extra 3mm breathing room. */
        bottom: "calc(var(--dock-space) + 3mm)",
        
      }}

      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      whileTap={{ scale: 0.92 }}
    >
      <Link
        to="/chat"
        aria-label="Chat / चैट"
        className="dock-pill relative grid h-12 w-[4.5rem] place-items-center rounded-full brand-text shadow-lg"
      >
        <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </motion.div>
  );
}
