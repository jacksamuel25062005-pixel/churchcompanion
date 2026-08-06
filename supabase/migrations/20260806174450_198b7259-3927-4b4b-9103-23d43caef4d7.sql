-- 1. Reactions table
CREATE TABLE public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat text NOT NULL CHECK (chat IN ('congregation','youth')),
  message_id uuid NOT NULL,
  sender_ref text NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat, message_id, sender_ref, emoji)
);

GRANT SELECT ON public.chat_message_reactions TO anon;
GRANT SELECT ON public.chat_message_reactions TO authenticated;
GRANT ALL ON public.chat_message_reactions TO service_role;

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat members can read reactions"
  ON public.chat_message_reactions FOR SELECT
  USING (public.current_chat_session() IS NOT NULL OR public.is_chat_admin(auth.uid()));

CREATE INDEX chat_message_reactions_msg_idx ON public.chat_message_reactions (chat, message_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;

-- 2. Toggle a reaction (identity from the x-chat-session header)
CREATE OR REPLACE FUNCTION public.chat_react(_chat text, _message_id uuid, _emoji text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare s text; p text; n text; removed int;
begin
  s := public.current_chat_session();
  if s is null then raise exception 'No chat session'; end if;
  if length(btrim(coalesce(_emoji,''))) = 0 or length(_emoji) > 16 then raise exception 'Invalid emoji'; end if;

  if _chat = 'youth' then
    select u.phone_number, u.name into p, n from public.youth_chat_users u where u.session_id = s;
  else
    select u.phone_number, u.name into p, n from public.congregation_chat_users u where u.session_id = s;
  end if;
  if p is null then raise exception 'No chat session'; end if;

  delete from public.chat_message_reactions r
   where r.chat = _chat and r.message_id = _message_id and r.sender_ref = p and r.emoji = _emoji;
  get diagnostics removed = row_count;
  if removed > 0 then return 'removed'; end if;

  insert into public.chat_message_reactions(chat, message_id, sender_ref, sender_name, emoji)
  values (_chat, _message_id, p, coalesce(n,''), _emoji);
  return 'added';
end;
$$;

-- 3. Edit a message: sender or super admin
CREATE OR REPLACE FUNCTION public.chat_edit_message(_chat text, _id uuid, _content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare s text; p text; owner text; su boolean;
begin
  su := public.is_super_admin(auth.uid());
  s := public.current_chat_session();

  if length(btrim(coalesce(_content,''))) = 0 then raise exception 'Empty message'; end if;
  if length(_content) > 500 then raise exception 'Message too long (max 500)'; end if;

  if _chat = 'youth' then
    select m.phone_number into owner from public.youth_chat_messages m where m.id = _id;
  else
    select m.phone_number into owner from public.congregation_chat_messages m where m.id = _id;
  end if;
  if owner is null then raise exception 'Message not found'; end if;

  if not su then
    if s is null then raise exception 'Not allowed'; end if;
    if _chat = 'youth' then
      select u.phone_number into p from public.youth_chat_users u where u.session_id = s;
    else
      select u.phone_number into p from public.congregation_chat_users u where u.session_id = s;
    end if;
    if p is null or p <> owner then raise exception 'Not allowed'; end if;
  end if;

  if _chat = 'youth' then
    update public.youth_chat_messages
       set message_content = btrim(_content), is_edited = true, edited_at = now()
     where id = _id;
  else
    update public.congregation_chat_messages
       set message_content = btrim(_content), is_edited = true, edited_at = now()
     where id = _id;
  end if;
end;
$$;

-- 4. Delete a message: super admin only
CREATE OR REPLACE FUNCTION public.chat_delete_message(_chat text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_super_admin(auth.uid()) then raise exception 'Only a super admin can delete messages'; end if;
  delete from public.chat_message_reactions where chat = _chat and message_id = _id;
  if _chat = 'youth' then
    delete from public.youth_chat_messages where id = _id;
  else
    delete from public.congregation_chat_messages where id = _id;
  end if;
end;
$$;

-- 5. Congregation member management (super admin only)
CREATE OR REPLACE FUNCTION public.congregation_admin_users()
RETURNS TABLE(phone_number text, name text, is_online boolean, last_seen timestamptz, joined_at timestamptz, message_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_chat_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  return query
    select u.phone_number, u.name, u.is_online, u.last_seen, u.joined_at,
           (select count(*) from public.congregation_chat_messages m where m.phone_number = u.phone_number)
      from public.congregation_chat_users u
     order by u.last_seen desc;
end;
$$;

CREATE OR REPLACE FUNCTION public.congregation_admin_update_user(_phone text, _name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_super_admin(auth.uid()) then raise exception 'Only a super admin can edit members'; end if;
  if length(btrim(coalesce(_name,''))) < 2 or length(btrim(_name)) > 50 then
    raise exception 'Name must be 2-50 characters';
  end if;
  update public.congregation_chat_users set name = btrim(_name) where phone_number = _phone;
  update public.congregation_chat_messages set sender_name = btrim(_name) where phone_number = _phone;
end;
$$;

CREATE OR REPLACE FUNCTION public.congregation_admin_remove_user(_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_super_admin(auth.uid()) then raise exception 'Only a super admin can remove members'; end if;
  delete from public.chat_message_reactions where chat = 'congregation' and sender_ref = _phone;
  delete from public.congregation_chat_messages where phone_number = _phone;
  delete from public.congregation_chat_users where phone_number = _phone;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.chat_react(text, uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.chat_edit_message(text, uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.chat_delete_message(text, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.congregation_admin_users() FROM public;
REVOKE EXECUTE ON FUNCTION public.congregation_admin_update_user(text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.congregation_admin_remove_user(text) FROM public;

GRANT EXECUTE ON FUNCTION public.chat_react(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_edit_message(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_delete_message(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.congregation_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.congregation_admin_update_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.congregation_admin_remove_user(text) TO authenticated;