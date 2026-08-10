CREATE TABLE IF NOT EXISTS public.chat_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat text NOT NULL CHECK (chat IN ('congregation','youth')),
  message_id uuid NOT NULL,
  reader_ref text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (chat, message_id, reader_ref)
);

GRANT ALL ON public.chat_receipts TO service_role;
ALTER TABLE public.chat_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view chat receipts"
ON public.chat_receipts FOR SELECT TO authenticated
USING (public.is_chat_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS chat_receipts_message_idx ON public.chat_receipts (chat, message_id);

-- Record delivery / read for the caller's own chat session.
CREATE OR REPLACE FUNCTION public.chat_mark_receipts(_chat text, _ids uuid[], _read boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare s text; p text;
begin
  if _ids is null or array_length(_ids, 1) is null then return; end if;
  s := public.current_chat_session();
  if s is null then return; end if;

  if _chat = 'youth' then
    select u.phone_number into p from public.youth_chat_users u where u.session_id = s;
  elsif _chat = 'congregation' then
    select u.phone_number into p from public.congregation_chat_users u where u.session_id = s;
  else
    return;
  end if;
  if p is null then return; end if;

  if _chat = 'youth' then
    insert into public.chat_receipts (chat, message_id, reader_ref, read_at)
    select 'youth', m.id, p, case when _read then now() else null end
      from public.youth_chat_messages m
     where m.id = any(_ids) and m.phone_number <> p
    on conflict (chat, message_id, reader_ref) do update
      set read_at = case when _read then coalesce(public.chat_receipts.read_at, now())
                         else public.chat_receipts.read_at end;
  else
    insert into public.chat_receipts (chat, message_id, reader_ref, read_at)
    select 'congregation', m.id, p, case when _read then now() else null end
      from public.congregation_chat_messages m
     where m.id = any(_ids) and m.phone_number <> p
    on conflict (chat, message_id, reader_ref) do update
      set read_at = case when _read then coalesce(public.chat_receipts.read_at, now())
                         else public.chat_receipts.read_at end;
  end if;
end;
$$;

-- Receipt counts for the caller's own messages only.
CREATE OR REPLACE FUNCTION public.chat_receipt_state(_chat text, _ids uuid[])
RETURNS TABLE(message_id uuid, delivered_count integer, read_count integer, audience integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare s text; p text; aud integer;
begin
  if _ids is null or array_length(_ids, 1) is null then return; end if;
  s := public.current_chat_session();
  if s is null then return; end if;

  if _chat = 'youth' then
    select u.phone_number into p from public.youth_chat_users u where u.session_id = s;
    select greatest(count(*) - 1, 0) into aud from public.youth_chat_users;
  elsif _chat = 'congregation' then
    select u.phone_number into p from public.congregation_chat_users u where u.session_id = s;
    select greatest(count(*) - 1, 0) into aud from public.congregation_chat_users;
  else
    return;
  end if;
  if p is null then return; end if;

  if _chat = 'youth' then
    return query
      select m.id,
             (select count(*)::int from public.chat_receipts r where r.chat = 'youth' and r.message_id = m.id),
             (select count(*)::int from public.chat_receipts r where r.chat = 'youth' and r.message_id = m.id and r.read_at is not null),
             aud
        from public.youth_chat_messages m
       where m.id = any(_ids) and m.phone_number = p;
  else
    return query
      select m.id,
             (select count(*)::int from public.chat_receipts r where r.chat = 'congregation' and r.message_id = m.id),
             (select count(*)::int from public.chat_receipts r where r.chat = 'congregation' and r.message_id = m.id and r.read_at is not null),
             aud
        from public.congregation_chat_messages m
       where m.id = any(_ids) and m.phone_number = p;
  end if;
end;
$$;

REVOKE ALL ON FUNCTION public.chat_mark_receipts(text, uuid[], boolean) FROM public;
REVOKE ALL ON FUNCTION public.chat_receipt_state(text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.chat_mark_receipts(text, uuid[], boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_receipt_state(text, uuid[]) TO anon, authenticated;