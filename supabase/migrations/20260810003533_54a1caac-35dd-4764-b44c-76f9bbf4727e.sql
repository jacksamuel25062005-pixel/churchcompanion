-- 1) Book pages: scope public reads to published books
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Public can view pages of existing books" ON public.book_pages;
CREATE POLICY "Public can view pages of published books"
ON public.book_pages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.books b
  WHERE b.id = book_pages.book_id AND b.is_published
) OR public.is_chat_admin(auth.uid()));

-- 2) Timeline likes: ownership proven by a device secret, only its hash is stored
DROP POLICY IF EXISTS "likes public insert" ON public.timeline_article_likes;

DROP FUNCTION IF EXISTS public.unlike_timeline_article(uuid, text);

CREATE OR REPLACE FUNCTION public.like_timeline_article(p_article_id uuid, p_client_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare h text;
begin
  if p_client_secret is null or length(p_client_secret) < 16 then
    raise exception 'Invalid client token';
  end if;
  h := encode(digest(p_client_secret, 'sha256'), 'hex');
  insert into public.timeline_article_likes(article_id, liker_client_id)
  values (p_article_id, h)
  on conflict do nothing;
end;
$$;

CREATE OR REPLACE FUNCTION public.timeline_like_state(p_article_id uuid, p_client_secret text)
RETURNS TABLE(total bigint, liked boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare h text;
begin
  h := case when p_client_secret is null or length(p_client_secret) < 16
            then null
            else encode(digest(p_client_secret, 'sha256'), 'hex') end;
  return query
    select (select count(*) from public.timeline_article_likes l where l.article_id = p_article_id),
           (h is not null and exists (
              select 1 from public.timeline_article_likes l
               where l.article_id = p_article_id and l.liker_client_id = h));
end;
$$;

CREATE OR REPLACE FUNCTION public.unlike_timeline_article(p_article_id uuid, p_client_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare h text;
begin
  if p_client_secret is null or length(p_client_secret) < 16 then
    raise exception 'Invalid client token';
  end if;
  h := encode(digest(p_client_secret, 'sha256'), 'hex');
  delete from public.timeline_article_likes
   where article_id = p_article_id and liker_client_id = h;
end;
$$;

REVOKE ALL ON FUNCTION public.like_timeline_article(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.unlike_timeline_article(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.timeline_like_state(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.like_timeline_article(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlike_timeline_article(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.timeline_like_state(uuid, text) TO anon, authenticated;

-- 3) Chat session lookup limited to the caller's own verified session
CREATE OR REPLACE FUNCTION public.chat_session_info(_chat text, _session text)
RETURNS TABLE(name text, phone_number text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
begin
  if _session is null or _session is distinct from public.current_chat_session() then
    return;
  end if;
  if _chat = 'youth' then
    return query select u.name, u.phone_number from public.youth_chat_users u where u.session_id = _session;
  else
    return query select u.name, u.phone_number from public.congregation_chat_users u where u.session_id = _session;
  end if;
end;
$$;