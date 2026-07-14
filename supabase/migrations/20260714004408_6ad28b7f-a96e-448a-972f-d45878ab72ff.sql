
-- 1) Comments: length-validated insert
DROP POLICY IF EXISTS "comments public insert" ON public.timeline_article_comments;
CREATE POLICY "comments public insert"
  ON public.timeline_article_comments
  FOR INSERT
  TO public
  WITH CHECK (
    is_hidden = false
    AND commenter_name IS NOT NULL
    AND char_length(btrim(commenter_name)) BETWEEN 1 AND 60
    AND comment_text IS NOT NULL
    AND char_length(btrim(comment_text)) BETWEEN 1 AND 1000
  );

-- 2) Likes: remove open delete; enforce insert has client id; provide ownership-checked unlike RPC
DROP POLICY IF EXISTS "likes public delete" ON public.timeline_article_likes;
DROP POLICY IF EXISTS "likes public insert" ON public.timeline_article_likes;
CREATE POLICY "likes public insert"
  ON public.timeline_article_likes
  FOR INSERT
  TO public
  WITH CHECK (
    liker_client_id IS NOT NULL
    AND char_length(liker_client_id) BETWEEN 8 AND 100
  );

CREATE OR REPLACE FUNCTION public.unlike_timeline_article(p_article_id uuid, p_client_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.timeline_article_likes
   WHERE article_id = p_article_id
     AND liker_client_id = p_client_id;
$$;
REVOKE ALL ON FUNCTION public.unlike_timeline_article(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlike_timeline_article(uuid, text) TO anon, authenticated;

-- 3) about-media storage: only allow reads of photos attached to published entries (or admins)
DROP POLICY IF EXISTS "about-media read auth or anon signed" ON storage.objects;
CREATE POLICY "about-media read published or admin"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'about-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::app_role, 'super_admin'::app_role)
      )
      OR EXISTS (
        SELECT 1 FROM public.about_church_entries e
        WHERE e.is_published = true
          AND storage.objects.name = ANY (e.photo_urls)
      )
      OR EXISTS (
        SELECT 1 FROM public.church_timeline_articles a
        WHERE a.is_published = true
          AND storage.objects.name = ANY (a.photo_urls)
      )
    )
  );
