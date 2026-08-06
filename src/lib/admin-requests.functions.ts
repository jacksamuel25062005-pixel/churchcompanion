import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

/**
 * Files an admin-access request right after sign-up.
 *
 * Sign-up with email confirmation returns a user but NO session, so a direct
 * client insert runs as `anon` and is rejected by RLS. This records the request
 * server-side after verifying the user id really belongs to that email.
 */
export const submitAdminRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userErr || !userRes?.user) throw new Error("Account not found");
    if ((userRes.user.email ?? "").toLowerCase() !== data.email.toLowerCase()) {
      throw new Error("Account mismatch");
    }

    const { data: existing } = await supabaseAdmin
      .from("admin_requests")
      .select("id, status")
      .eq("user_id", data.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true, duplicate: true };

    const { error } = await supabaseAdmin.from("admin_requests").insert({
      user_id: data.userId,
      reason: data.reason?.trim() || "Requesting admin access",
    });
    if (error) throw new Error(error.message);
    return { ok: true, duplicate: false };
  });
