
DROP POLICY IF EXISTS "Delete own like by client id" ON public.timeline_article_likes;
CREATE POLICY "Delete own like by client id"
  ON public.timeline_article_likes
  FOR DELETE
  TO anon, authenticated
  USING (liker_client_id IS NOT NULL AND length(liker_client_id) > 0);
