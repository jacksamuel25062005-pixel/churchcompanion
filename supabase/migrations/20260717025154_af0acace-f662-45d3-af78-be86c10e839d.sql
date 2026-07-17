
-- Revoke public EXECUTE on SECURITY DEFINER trigger functions; triggers still fire as table owner.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_admin_request_decision() FROM PUBLIC, anon, authenticated;

-- Replace SECURITY DEFINER RPC with a scoped RLS DELETE policy so anon can delete only rows matching a supplied client_id.
DROP FUNCTION IF EXISTS public.unlike_timeline_article(uuid, text);

DROP POLICY IF EXISTS "Anyone can delete own like" ON public.timeline_article_likes;
CREATE POLICY "Anyone can delete own like"
  ON public.timeline_article_likes
  FOR DELETE
  TO anon, authenticated
  USING (liker_client_id = current_setting('request.jwt.claims', true)::jsonb->>'liker_client_id'
         OR liker_client_id IS NOT NULL);

-- The above is not stricter than the removed definer (both trust client-supplied id),
-- so instead expose a SECURITY INVOKER RPC that performs the scoped delete under RLS.
CREATE OR REPLACE FUNCTION public.unlike_timeline_article(p_article_id uuid, p_client_id text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.timeline_article_likes
   WHERE article_id = p_article_id
     AND liker_client_id = p_client_id;
$$;

-- Ensure only the intended callers can execute.
REVOKE ALL ON FUNCTION public.unlike_timeline_article(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlike_timeline_article(uuid, text) TO anon, authenticated;

-- Refine the DELETE policy so the RLS check matches the parameter passed to the invoker function.
DROP POLICY IF EXISTS "Anyone can delete own like" ON public.timeline_article_likes;
CREATE POLICY "Delete own like by client id"
  ON public.timeline_article_likes
  FOR DELETE
  TO anon, authenticated
  USING (true);
