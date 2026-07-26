import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "../../components/AppShell";
import { BackButton, Card } from "../../components/ui-bits";
import { ImageLightbox } from "../../components/ImageLightbox";
import { useT, pickLang } from "../../lib/i18n";
import { signAboutMedia } from "../../lib/about-media";

export const Route = createFileRoute("/about/church/$id")({
  component: AboutChurchDetail,
});

function AboutChurchDetail() {
  const { id } = useParams({ from: "/about/church/$id" });
  const { language } = useT();
  const [lightbox, setLightbox] = useState<number | null>(null);


  const q = useQuery({
    queryKey: ["about_church_entry", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("about_church_entries").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const paths = useMemo(() => q.data?.photo_urls ?? [], [q.data]);
  const signedQ = useQuery({
    queryKey: ["about_church_entry_signed", id, paths.join("|")],
    enabled: paths.length > 0,
    queryFn: () => signAboutMedia(paths),
  });

  return (
    <AppShell>
      <div className="mt-2 text-xs text-muted-foreground">
        <BackButton to="/about/church" label="About Church" />
      </div>
      {q.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : !q.data ? (
        <p className="mt-4 text-sm text-muted-foreground">Not found.</p>
      ) : (
        <>
          <h1 className="mt-3 font-display text-2xl font-bold">{pickLang(q.data.title_en, q.data.title_hi, language)}</h1>
          {paths.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {paths.map((p: string) => signedQ.data?.[p] && (
                <img key={p} src={signedQ.data[p]} alt="" className="w-full rounded-xl object-cover aspect-square" loading="lazy" />
              ))}
            </div>
          )}
          <Card className="mt-4 p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {pickLang(q.data.body_en, q.data.body_hi, language)}
            </p>
          </Card>
        </>
      )}
    </AppShell>
  );
}
