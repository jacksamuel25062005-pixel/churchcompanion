
-- 1. updated_at + is_deleted on syncable tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['songs','book_sections','today_song_sets','today_song_items']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_at)', t || '_updated_at_idx', t);
  END LOOP;
END $$;

-- 2. shared updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['songs','book_sections','today_song_sets','today_song_items']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t);
  END LOOP;
END $$;

-- 3. server clock
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$ SELECT now() $$;

REVOKE EXECUTE ON FUNCTION public.server_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated;

-- 4. delta-pull function (respects caller RLS via SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.sync_pull(since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := COALESCE(since, 'epoch'::timestamptz);
  result jsonb;
  server_time timestamptz := now();
BEGIN
  SELECT jsonb_build_object(
    'server_time', server_time,
    'books',            COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.books b), '[]'::jsonb),
    'songs',            COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.songs s WHERE s.updated_at > cutoff), '[]'::jsonb),
    'book_sections',    COALESCE((SELECT jsonb_agg(to_jsonb(bs)) FROM public.book_sections bs WHERE bs.updated_at > cutoff), '[]'::jsonb),
    'today_song_sets',  COALESCE((SELECT jsonb_agg(to_jsonb(ts)) FROM public.today_song_sets ts WHERE ts.updated_at > cutoff), '[]'::jsonb),
    'today_song_items', COALESCE((SELECT jsonb_agg(to_jsonb(ti)) FROM public.today_song_items ti WHERE ti.updated_at > cutoff), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_pull(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_pull(timestamptz) TO anon, authenticated;
