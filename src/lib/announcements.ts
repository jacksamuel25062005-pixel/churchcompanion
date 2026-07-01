import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnnouncementAudience = "ChurchMembers" | "YouthGroup";

export interface Announcement {
  id: string;
  topic: string;
  date: string;
  body: string;
  audience: AnnouncementAudience;
  published: boolean;
  created_at: string;
  created_by: string | null;
}

export type UserRole = "guest" | "member" | "youth_member" | "admin" | "super_admin";

export function filterAnnouncements(list: Announcement[], role: UserRole | null): Announcement[] {
  return list.filter((a) => {
    if (!a.published) return false;
    if (!role || role === "guest") return false;
    if (a.audience === "ChurchMembers")
      return ["member", "youth_member", "admin", "super_admin"].includes(role);
    if (a.audience === "YouthGroup")
      return ["youth_member", "admin", "super_admin"].includes(role);
    return false;
  });
}

/** Resolves the current user's effective role. */
export function useUserRole(): UserRole | null {
  const [role, setRole] = useState<UserRole | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!u.user) return setRole("guest");
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = (rows ?? []).map((r) => r.role as string);
      if (cancelled) return;
      if (roles.includes("super_admin")) setRole("super_admin");
      else if (roles.includes("admin")) setRole("admin");
      else setRole("member");
    })();
    return () => { cancelled = true; };
  }, []);
  return role;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("published", true)
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
  });
}

export function useAllAnnouncements() {
  return useQuery({
    queryKey: ["announcements", "all"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
  });
}
