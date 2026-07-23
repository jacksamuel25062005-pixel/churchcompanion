-- Tighten book_pages read access to only rows tied to an existing book
DROP POLICY IF EXISTS "Anyone can view book pages" ON public.book_pages;
CREATE POLICY "Public can view pages of existing books"
ON public.book_pages FOR SELECT
USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_pages.book_id));

-- Remove direct DELETE for likes; force use of the SECURITY DEFINER RPC that
-- verifies possession of the caller's client id secret. Enumeration is already
-- prevented because liker_client_id column privileges are not granted to
-- anon/authenticated (only the row exists check remains).
DROP POLICY IF EXISTS "likes owner delete" ON public.timeline_article_likes;
REVOKE DELETE ON public.timeline_article_likes FROM anon, authenticated;

-- Recreate unlike RPC as SECURITY DEFINER so it can bypass the removed DELETE
-- policy while still requiring the caller to present their client_id secret.
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
     AND length(p_client_id) >= 8;
$$;

REVOKE ALL ON FUNCTION public.unlike_timeline_article(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlike_timeline_article(uuid, text) TO anon, authenticated;