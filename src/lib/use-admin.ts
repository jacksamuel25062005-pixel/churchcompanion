import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Lightweight read-only admin flag (no redirect). Safe for public pages. */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (cancelled) return;
      const roles = (data ?? []).map((r) => r.role);
      setIsAdmin(roles.includes("admin") || roles.includes("super_admin"));
    })();
    return () => { cancelled = true; };
  }, []);
  return isAdmin;
}
