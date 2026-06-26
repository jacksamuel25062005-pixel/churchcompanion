import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Redirects to /admin unless the signed-in user has admin or super_admin role. */
export function useAdminGuard() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"admin" | "super_admin" | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { if (!cancelled) navigate({ to: "/admin" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const r = (roles ?? []).map((x) => x.role);
      if (cancelled) return;
      if (r.includes("super_admin")) setRole("super_admin");
      else if (r.includes("admin")) setRole("admin");
      else { navigate({ to: "/admin" }); return; }
      setChecked(true);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return { role, checked };
}
