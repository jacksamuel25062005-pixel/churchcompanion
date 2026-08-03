create or replace function public.congregation_session_exists(_sid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.congregation_profiles p where p.device_session_id = _sid);
$$;
revoke all on function public.congregation_session_exists(text) from public;
grant execute on function public.congregation_session_exists(text) to anon, authenticated;

drop policy if exists "post congregation messages" on public.chat_messages;
create policy "post congregation messages" on public.chat_messages
for insert to anon, authenticated
with check (channel = 'congregation' and public.congregation_session_exists(sender_ref));