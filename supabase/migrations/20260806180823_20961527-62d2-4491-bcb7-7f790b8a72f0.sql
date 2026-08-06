-- 1. Revoke EXECUTE on internal-only SECURITY DEFINER functions
revoke execute on function public.is_super_admin(uuid) from anon, authenticated, public;
revoke execute on function public.is_chat_admin(uuid) from anon, authenticated, public;
revoke execute on function public.can_read_message(uuid) from anon, authenticated, public;
revoke execute on function public.current_youth_id() from anon, authenticated, public;
revoke execute on function public.current_youth_token() from anon, authenticated, public;
revoke execute on function public.current_chat_session() from anon, authenticated, public;
revoke execute on function public.current_congregation_ref() from anon, authenticated, public;
revoke execute on function public.current_congregation_token() from anon, authenticated, public;
revoke execute on function public.has_congregation_session() from anon, authenticated, public;
revoke execute on function public.has_youth_session() from anon, authenticated, public;
revoke execute on function public.congregation_register(text, text, text) from anon, authenticated, public;
revoke execute on function public.congregation_session_exists(text) from anon, authenticated, public;
revoke execute on function public.youth_check_phone(text) from anon, authenticated, public;
revoke execute on function public.youth_refresh_session(text) from anon, authenticated, public;

-- admin-only RPCs: signed-in only
revoke execute on function public.congregation_admin_users() from anon, public;
revoke execute on function public.congregation_admin_update_user(text, text) from anon, public;
revoke execute on function public.congregation_admin_remove_user(text) from anon, public;
revoke execute on function public.youth_review_request(uuid, boolean, text) from anon, public;
revoke execute on function public.chat_delete_message(text, uuid) from anon, public;

-- 2. Chat media uploads must be bound to a verified session folder
drop policy if exists "chat media upload" on storage.objects;
create policy "chat media upload"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'chat-media'
  and (
    (public.current_youth_id() is not null
      and name like (public.current_youth_id())::text || '/%')
    or (public.current_congregation_ref() is not null
      and name like public.current_congregation_ref() || '/%')
    or public.is_chat_admin(auth.uid())
  )
);

-- 3. Reactions / receipts must match the caller's verified identity
drop policy if exists "add reactions" on public.message_reactions;
create policy "add reactions"
on public.message_reactions for insert to anon, authenticated
with check (
  public.can_read_message(message_id)
  and sender_ref = coalesce((public.current_youth_id())::text, public.current_congregation_ref())
);

drop policy if exists "remove own reactions" on public.message_reactions;
create policy "remove own reactions"
on public.message_reactions for delete to anon, authenticated
using (
  sender_ref = coalesce((public.current_youth_id())::text, public.current_congregation_ref())
  or public.is_super_admin(auth.uid())
);

drop policy if exists "add receipts" on public.message_receipts;
create policy "add receipts"
on public.message_receipts for insert to anon, authenticated
with check (
  public.can_read_message(message_id)
  and reader_ref = coalesce((public.current_youth_id())::text, public.current_congregation_ref())
);

-- 4. Reports require a verified session identity
drop policy if exists "anyone can report" on public.chat_reports;
create policy "verified sessions can report"
on public.chat_reports for insert to anon, authenticated
with check (
  public.can_read_message(message_id)
  and reporter_ref = coalesce((public.current_youth_id())::text, public.current_congregation_ref())
);

drop policy if exists "admins update reports" on public.chat_reports;
create policy "admins update reports"
on public.chat_reports for update to authenticated
using (public.is_chat_admin(auth.uid()))
with check (public.is_chat_admin(auth.uid()));

-- 5. Remove open write path on congregation profiles
drop policy if exists "anyone can register" on public.congregation_profiles;