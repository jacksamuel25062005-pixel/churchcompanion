DROP POLICY IF EXISTS "Delete own like by client id" ON public.timeline_article_likes;

CREATE OR REPLACE FUNCTION public.unlike_timeline_article(p_article_id uuid, p_client_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.timeline_article_likes
   WHERE article_id = p_article_id
     AND liker_client_id = p_client_id
     AND p_client_id IS NOT NULL
     AND length(p_client_id) > 0;
$$;

REVOKE ALL ON FUNCTION public.unlike_timeline_article(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlike_timeline_article(uuid, text) TO anon, authenticated;