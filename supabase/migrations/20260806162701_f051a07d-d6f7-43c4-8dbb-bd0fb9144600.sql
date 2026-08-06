-- 1) Congregation identity binding -------------------------------------------------
alter table public.congregation_profiles
  add column if not exists session_token text;

update public.congregation_profiles
   set session_token = device_session_id
 where session_token is null;

alter table public.congregation_profiles
  alter column session_token set not null;

create unique index if not exists congregation_profiles_session_token_key
  on public.congregation_profiles(session_token);

create or replace function public.current_congregation_token()
returns text language sql stable security definer set search_path to 'public'
as $$
  select nullif(coalesce(current_setting('request.headers', true)::json ->> 'x-congregation-token', ''), '')
$$;

create or replace function public.current_congregation_ref()
returns text language sql stable security definer set search_path to 'public'
as $$
  select p.device_session_id
    from public.congregation_profiles p
   where p.session_token = public.current_congregation_token()
   limit 1
$$;

drop policy if exists "post congregation messages" on public.chat_messages;
create policy "post congregation messages"
on public.chat_messages for insert
with check (
  channel = 'congregation'
  and sender_ref = public.current_congregation_ref()
);

-- 2) Chat media scoping --------------------------------------------------------------
drop policy if exists "chat media read" on storage.objects;
create policy "chat media read"
on storage.objects for select
using (
  bucket_id = 'chat-media'
  and (
    public.is_chat_admin(auth.uid())
    or exists (
      select 1 from public.chat_messages m
      where m.media_url = storage.objects.name
        and (m.channel = 'congregation' or public.current_youth_id() is not null)
    )
  )
);

drop policy if exists "chat media upload" on storage.objects;
create policy "chat media upload"
on storage.objects for insert
with check (
  bucket_id = 'chat-media'
  and (
    public.current_youth_id() is not null
    or public.current_congregation_ref() is not null
    or public.is_chat_admin(auth.uid())
  )
);
