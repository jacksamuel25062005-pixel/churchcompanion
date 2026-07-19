import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../components/AppShell";
import { EmptyState } from "../components/ui-bits";
import { useT } from "../lib/i18n";
import { Search as SearchIcon } from "lucide-react";

interface Result {
  kind: "song" | "section";
  id: string;
  title: string;
  snippet: string;
  book_slug: string;
  number: number | null;
}

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Church Companion" },
      { name: "description", content: "Full-text search across songs and books." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { t } = useT();
  const [q, setQ] = useState("");

  const sQ = useQuery({
    queryKey: ["search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_content", { q: q.trim() });
      if (error) throw error;
      return (data ?? []) as Result[];
    },
  });

  return (
    <AppShell title={t("nav.search")}>
      <div className="pt-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("common.search_ph")}
            className="focus-ring w-full pl-10 pr-3 py-3 rounded-xl glass-chip text-sm outline-none"
            inputMode="search"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {q.trim().length < 2 ? (
          <EmptyState
            title="Search songs and books"
            hint="Type at least 2 characters to see matches."
            icon={<SearchIcon className="h-5 w-5" />}
          />
        ) : sQ.isLoading ? (
          <div className="space-y-2">
            {[0,1,2].map((i) => (
              <div key={i} className="glass rounded-2xl p-4 space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted/60 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-muted/60 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (sQ.data ?? []).length === 0 ? (
          <EmptyState title="No matches" hint="Try a different word, or check your spelling." icon={<SearchIcon className="h-5 w-5" />} />
        ) : (
          (sQ.data ?? []).map((r) => (
            <Link
              key={`${r.kind}-${r.id}`}
              to={r.kind === "song" ? "/books/song-book/$id" : "/books/$slug"}
              params={r.kind === "song" ? { id: r.id } : { slug: r.book_slug }}
              className="premium-card tap-card focus-ring block hover:bg-secondary/40"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="rounded-full brand-bg px-2 py-0.5 font-bold uppercase tracking-wider">{r.kind}</span>
                {r.number != null && <span>#{r.number}</span>}
                <span>· {r.book_slug}</span>
              </div>
              <p className="font-semibold font-hi truncate">{r.title || "(untitled)"}</p>
              {r.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-hi">{r.snippet}</p>}
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}

