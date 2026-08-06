-- Hide deleted message content from members; admins retain visibility
drop policy if exists "read chat messages" on public.chat_messages;
create policy "read chat messages"
on public.chat_messages for select to anon, authenticated
using (
  public.is_chat_admin(auth.uid())
  or (
    deleted = false
    and (channel = 'congregation' or public.current_youth_id() is not null)
  )
);

-- Restrict congregation member records (phone number PII) to the owner and admins
drop policy if exists "cong users readable to members" on public.congregation_chat_users;
create policy "cong users readable to self or admins"
on public.congregation_chat_users for select to anon, authenticated
using (
  public.is_chat_admin(auth.uid())
  or session_id = public.current_chat_session()
);