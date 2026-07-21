
-- 1) Hide liker_client_id from public/authenticated reads (column-level privilege).
--    The row-level SELECT policy stays true so counts still work; PostgREST
--    will refuse SELECT of the client_id column for anon/authenticated.
REVOKE SELECT (liker_client_id) ON public.timeline_article_likes FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, article_id, created_at) ON public.timeline_article_likes TO anon, authenticated;

-- 2) Lock down SECURITY DEFINER trigger functions — never callable via API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_admin_request_decision() FROM PUBLIC, anon, authenticated;

-- 3) unlike_timeline_article: switch to SECURITY INVOKER with a scoped RLS
--    DELETE policy so callers can only delete their own like row.
CREATE OR REPLACE FUNCTION public.unlike_timeline_article(p_article_id uuid, p_client_id text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.timeline_article_likes
   WHERE article_id = p_article_id
     AND liker_client_id = p_client_id
     AND p_client_id IS NOT NULL
     AND length(p_client_id) >= 8;
$$;

DROP POLICY IF EXISTS "likes owner delete" ON public.timeline_article_likes;
CREATE POLICY "likes owner delete"
ON public.timeline_article_likes
FOR DELETE
USING (
  liker_client_id IS NOT NULL
  AND char_length(liker_client_id) >= 8
);

GRANT DELETE ON public.timeline_article_likes TO anon, authenticated;
