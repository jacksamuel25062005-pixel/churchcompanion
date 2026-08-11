import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://churchcompanion.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/books/song-book", changefreq: "weekly", priority: "0.9" },
  { path: "/books/song-book/church", changefreq: "weekly", priority: "0.8" },
  { path: "/books/song-book/additional", changefreq: "weekly", priority: "0.8" },
  { path: "/almanac", changefreq: "daily", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/about/church", changefreq: "monthly", priority: "0.6" },
  { path: "/about/timeline", changefreq: "monthly", priority: "0.6" },
  { path: "/search", changefreq: "monthly", priority: "0.5" },
  { path: "/bookmarks", changefreq: "monthly", priority: "0.3" },
  { path: "/settings", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        try {
          const supabase = createClient<Database>(
            process.env["SUPABASE_URL"]!,
            process.env["SUPABASE_PUBLISHABLE_KEY"]!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );

          const [books, songs, church, timeline] = await Promise.all([
            supabase.from("books").select("slug").eq("is_published", true),
            supabase.from("songs").select("id").eq("is_deleted", false),
            supabase.from("about_church_entries").select("id").eq("is_published", true),
            supabase.from("church_timeline_articles").select("id").eq("is_published", true),
          ]);

          for (const b of books.data ?? [])
            if (b.slug !== "song-book")
              entries.push({ path: `/books/${b.slug}`, changefreq: "monthly", priority: "0.7" });
          for (const s of songs.data ?? [])
            entries.push({ path: `/books/song-book/${s.id}`, changefreq: "monthly", priority: "0.6" });
          for (const c of church.data ?? [])
            entries.push({ path: `/about/church/${c.id}`, changefreq: "monthly", priority: "0.5" });
          for (const a of timeline.data ?? [])
            entries.push({ path: `/about/timeline/${a.id}`, changefreq: "monthly", priority: "0.5" });
        } catch {
          /* fall back to the static routes */
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
