import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card, EmptyState } from "../../components/ui-bits";
import { OfflineButton } from "../../components/OfflineButton";
import { useT, pickLang } from "../../lib/i18n";
import { useBrandOverride } from "../../lib/settings";
import { continueReading } from "../../lib/storage";
import { useBookSnap, saveBook, removeOffline, OFFLINE_KEYS } from "../../lib/offline";
import type { Book, BookSection } from "../../lib/types";

export const Route = createFileRoute("/books/$slug")({
  component: BookView,
});

function BookView() {
  const { slug } = useParams({ from: "/books/$slug" });
  const { t, language } = useT();
  const snap = useBookSnap(slug);

  const bookQ = useQuery({
    queryKey: ["book", slug],
    initialData: snap?.book,
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("*").eq("slug", slug).single();
      if (error) throw error;
      return data as Book;
    },
  });
  useBrandOverride(bookQ.data?.accent_color);

  const sectionsQ = useQuery({
    queryKey: ["sections", slug],
    enabled: !!bookQ.data,
    initialData: snap?.sections,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_sections")
        .select("*")
        .eq("book_id", bookQ.data!.id)
        .order("sort_order")
        .order("number");
      if (error) throw error;
      return data as BookSection[];
    },
  });

  // Refresh offline snapshot if the user has previously downloaded this book.
  useEffect(() => {
    if (!bookQ.data || !sectionsQ.data) return;
    if (!snap) return;
    saveBook(slug, { book: bookQ.data, sections: sectionsQ.data, at: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookQ.data, sectionsQ.data, slug]);

  // Redirect song-book to its dedicated index
  if (slug === "song-book") {
    return (
      <AppShell title="Song Book" left={<BackButton to="/" />}>
        <p className="py-6 text-sm">
          <Link to="/books/song-book" className="brand-text underline">Open Song Book</Link>
        </p>
      </AppShell>
    );
  }

  const title = pickLang(bookQ.data?.title_en, bookQ.data?.title_hi, language) || "";

  const handleDownload = async () => {
    let book = bookQ.data;
    if (!book) {
      const { data, error } = await supabase.from("books").select("*").eq("slug", slug).single();
      if (error) throw error;
      book = data as Book;
    }
    let sections = sectionsQ.data;
    if (!sections) {
      const { data, error } = await supabase
        .from("book_sections")
        .select("*")
        .eq("book_id", book!.id)
        .order("sort_order")
        .order("number");
      if (error) throw error;
      sections = data as BookSection[];
    }
    saveBook(slug, { book: book!, sections: sections!, at: Date.now() });
  };

  return (
    <AppShell title={title} left={<BackButton to="/" />}>
      <div className="pt-4">
        {bookQ.data && (
          <div className="rounded-2xl p-5 text-white"
            style={{ background: `linear-gradient(140deg, ${bookQ.data.accent_color}, ${bookQ.data.accent_color}cc)` }}
          >
            <p className="text-[11px] uppercase tracking-wide opacity-80">{bookQ.data.title_en}</p>
            <h1 className="font-hi text-2xl font-bold leading-tight">{bookQ.data.title_hi}</h1>
            {bookQ.data.description_hi && (
              <p className="mt-2 text-sm opacity-90 font-hi">{bookQ.data.description_hi}</p>
            )}
          </div>
        )}

        <div className="mt-3">
          <OfflineButton
            storageKey={OFFLINE_KEYS.book(slug)}
            onDownload={handleDownload}
            onRemove={() => removeOffline(OFFLINE_KEYS.book(slug))}
          />
        </div>

        <div className="mt-5 space-y-3">
          {sectionsQ.isLoading && !sectionsQ.data ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !sectionsQ.data || sectionsQ.data.length === 0 ? (
            <EmptyState title={t("common.empty")} hint="Admins can upload content from the Admin section." />
          ) : (
            sectionsQ.data.map((s: BookSection) => (
              <SectionCard key={s.id} section={s} slug={slug} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SectionCard({ section, slug }: { section: BookSection; slug: string }) {
  const { language } = useT();
  const title = pickLang(section.title_en, section.title_hi, language) || "";
  const body = pickLang(section.body_en, section.body_hi, language) || "";

  useEffect(() => {
    if (!title) return;
  }, [title]);

  return (
    <details className="group">
      <summary className="tap-card list-none cursor-pointer rounded-2xl border bg-card px-4 py-3 flex items-center gap-3">
        <span className="w-9 text-right tabular-nums text-xs font-bold brand-text">{section.number ?? "—"}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate font-hi">{title}</p>
        </div>
        <span className="text-xs text-muted-foreground group-open:hidden">Open</span>
        <span className="text-xs text-muted-foreground hidden group-open:inline">Close</span>
      </summary>
      <div onClick={() => continueReading.set({ id: section.id, kind: "section", bookSlug: slug, title, at: Date.now() })}>
        <Card className="mt-2 p-5">
          <div className={`reader-prose ${language === "hi" ? "font-hi" : ""}`}>{body}</div>
        </Card>
      </div>
    </details>
  );
}
