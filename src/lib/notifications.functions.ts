import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SendInput = { title: string; message: string; url?: string };

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SendInput) => {
    if (!data || typeof data.title !== "string" || typeof data.message !== "string") {
      throw new Error("title and message are required");
    }
    const title = data.title.trim().slice(0, 200);
    const message = data.message.trim().slice(0, 1000);
    if (!title || !message) throw new Error("title and message must not be empty");
    const url = typeof data.url === "string" && data.url.trim() ? data.url.trim().slice(0, 500) : undefined;
    return { title, message, url };
  })
  .handler(async ({ data, context }) => {
    // Verify caller is admin or super_admin
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_admin_or_super", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!appId || !apiKey) throw new Error("OneSignal is not configured");

    const body: Record<string, unknown> = {
      app_id: appId,
      headings: { en: data.title },
      contents: { en: data.message },
      included_segments: ["Total Subscriptions"],
    };
    if (data.url) body.url = data.url;

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.errors ? JSON.stringify(json.errors) : `HTTP ${res.status}`;
      throw new Error(`OneSignal: ${msg}`);
    }

    return { id: json?.id ?? null, recipients: json?.recipients ?? 0 };
  });
