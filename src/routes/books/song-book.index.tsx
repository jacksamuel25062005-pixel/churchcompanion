import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { useT, pickLang } from "../../lib/i18n";
import { useBrandOverride } from "../../lib/settings";
import { useSongBookSnap } from "../../lib/offline";
import { Music, Sparkles, ChevronRight } from "lucide-react";
import type { Book } from "../../lib/types";

export const Route = createFileRoute("/books/song-book/")({
  head: () => ({
    meta: [
      { title: "Song Book — Church Companion" },
      { name: "description", content: "Choose a Song Book category — Church Song Book or Additional Songs." },
      { property: "og:title", content: "Song Book — Church Companion" },
      { property: "og:description", content: "Choose a Song Book category." },
    ],
  }),
  component: SongBookLanding,
});

function SongBookLanding() {
  const { language } = useT();
  const snap = useSongBookSnap();

  const bookQ = useQuery({
    queryKey: ["book", "song-book"],
    initialData: snap?.book,
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").eq("slug", "song-book").single();
      if (error) throw error;
      return data as Book;
    },
  });
  useBrandOverride(bookQ.data?.accent_color);

  const title = pickLang(bookQ.data?.title_en, bookQ.data?.title_hi, language) ?? "Song Book";
  const accent = bookQ.data?.accent_color ?? "#4F46E5";

  return (
    <AppShell title={title} left={<BackButton to="/" />}>
      <div className="pt-4 space-y-3">
        <p className="text-center text-xs text-muted-foreground">Pick a category to open</p>
        <CategoryCard
          to="/books/song-book/church"
          accent={accent}
          icon={<Music className="h-6 w-6" />}
          eyebrow="Category 1"
          titleEn="Church Song Book"
          titleHi="कलीसिया गीतमाला"
        />
        <CategoryCard
          to="/books/song-book/additional"
          accent={accent}
          icon={<Sparkles className="h-6 w-6" />}
          eyebrow="Category 2"
          titleEn="Additional Songs"
          titleHi="अतिरिक्त गीत"
        />
      </div>
    </AppShell>
  );
}

function CategoryCard({
  to, accent, icon, eyebrow, titleEn, titleHi,
}: {
  to: string;
  accent: string;
  icon: React.ReactNode;
  eyebrow: string;
  titleEn: string;
  titleHi: string;
}) {
  return (
    <Link
      to={to as any}
      className="tap-card focus-ring block"
    >
      <Card className="p-4 flex items-center gap-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white elev-1"
          style={{ background: `linear-gradient(140deg, ${accent}, ${accent}cc)` }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
          <p className="font-semibold truncate">{titleEn}</p>
          <p className="text-sm text-muted-foreground truncate font-hi">{titleHi}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Card>
    </Link>
  );
}
