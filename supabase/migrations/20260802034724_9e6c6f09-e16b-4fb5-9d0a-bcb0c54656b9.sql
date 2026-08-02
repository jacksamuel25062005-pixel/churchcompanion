CREATE OR REPLACE FUNCTION public.tg_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb;
  rid text;
  label text;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  rid := COALESCE(rec->>'id', '');

  IF TG_TABLE_NAME = 'songs' THEN
    label := COALESCE(rec->>'title_hi', rec->>'title_en', '');
  ELSIF TG_TABLE_NAME = 'books' THEN
    label := COALESCE(rec->>'title_en', rec->>'title_hi', '');
  ELSIF TG_TABLE_NAME = 'today_song_sets' THEN
    label := COALESCE(rec->>'title', rec->>'for_date', '');
  ELSE
    label := COALESCE(rec->>'song_id', '');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target, payload)
  VALUES (
    auth.uid(),
    lower(TG_OP) || ' ' || TG_TABLE_NAME,
    TG_TABLE_NAME || ':' || rid,
    jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'row_id', rid, 'label', label)
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_change() FROM anon, authenticated;

DROP TRIGGER IF EXISTS audit_songs ON public.songs;
CREATE TRIGGER audit_songs AFTER INSERT OR UPDATE OR DELETE ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_change();

DROP TRIGGER IF EXISTS audit_books ON public.books;
CREATE TRIGGER audit_books AFTER INSERT OR UPDATE OR DELETE ON public.books
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_change();

DROP TRIGGER IF EXISTS audit_today_song_sets ON public.today_song_sets;
CREATE TRIGGER audit_today_song_sets AFTER INSERT OR UPDATE OR DELETE ON public.today_song_sets
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_change();

DROP TRIGGER IF EXISTS audit_today_song_items ON public.today_song_items;
CREATE TRIGGER audit_today_song_items AFTER INSERT OR UPDATE OR DELETE ON public.today_song_items
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_change();

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);