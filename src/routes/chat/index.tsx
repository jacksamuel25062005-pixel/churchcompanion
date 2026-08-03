import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, MessagesSquare, Users } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { useT } from "../../lib/i18n";
import { lastMessage, unreadCount, getYouthIdentity, type ChatChannel } from "../../lib/chat";

export const Route = createFileRoute("/chat/")({
  component: ChatList,
  head: () => ({
    meta: [
      { title: "Chat · Church Companion" },
      { name: "description", content: "Congregation and youth chat for the Church Companion community." },
      { property: "og:title", content: "Chat · Church Companion" },
      { property: "og:description", content: "Congregation and youth chat for the Church Companion community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function timeLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function ChannelRow({ channel, title, subtitle, locked }: {
  channel: ChatChannel; title: string; subtitle: string; locked?: boolean;
}) {
  const q = useQuery({
    queryKey: ["chat-preview", channel, locked],
    refetchInterval: 20000,
    queryFn: async () => ({
      last: locked ? null : await lastMessage(channel),
      unread: locked ? 0 : await unreadCount(channel),
    }),
  });

  const preview = q.data?.last;
  const body = (
    <Card className="tap-card flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] brand-text">
        {channel === "youth" ? <Users className="h-5 w-5" /> : <MessagesSquare className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground font-hi">
          {locked ? subtitle : preview ? `${preview.sender_name}: ${preview.content ?? "📷"}` : subtitle}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px] text-muted-foreground">{timeLabel(preview?.created_at)}</span>
        {locked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (q.data?.unread ?? 0) > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
            {q.data!.unread}
          </span>
        ) : null}
      </div>
    </Card>
  );

  return (
    <Link to="/chat/$channel" params={{ channel }} className="block">
      {body}
    </Link>
  );
}

function ChatList() {
  const { t } = useT();
  const youth = typeof window !== "undefined" ? getYouthIdentity() : null;

  return (
    <AppShell title={t("chat.title")} left={<BackButton to="/" />}>
      <div className="mt-4 space-y-3">
        <ChannelRow
          channel="congregation"
          title={`${t("chat.congregation")} / मण्डली चैट`}
          subtitle={t("chat.no_messages")}
        />
        <ChannelRow
          channel="youth"
          title={`${t("chat.youth")} / युवा चैट`}
          subtitle={youth ? t("chat.no_messages") : t("chat.locked")}
          locked={!youth}
        />
      </div>
    </AppShell>
  );
}
