create or replace function public.is_super_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = _uid and r.role::text = 'super_admin')
$$;
revoke execute on function public.is_super_admin(uuid) from public;
grant execute on function public.is_super_admin(uuid) to authenticated;

create or replace function public.is_chat_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = _uid and r.role::text in ('admin','super_admin'))
$$;
revoke execute on function public.is_chat_admin(uuid) from public;
grant execute on function public.is_chat_admin(uuid) to authenticated;

create table public.congregation_profiles (
  id uuid primary key default gen_random_uuid(),
  device_session_id text not null unique,
  name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.approved_youth (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.youth_sessions (
  id uuid primary key default gen_random_uuid(),
  youth_id uuid not null references public.approved_youth(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index youth_sessions_token_idx on public.youth_sessions(token);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('congregation','youth')),
  sender_name text not null,
  sender_ref text not null,
  content text,
  media_url text,
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index chat_messages_channel_created_idx on public.chat_messages(channel, created_at);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  sender_ref text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, sender_ref, emoji)
);

create table public.message_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reader_ref text not null,
  read_at timestamptz not null default now(),
  unique (message_id, reader_ref)
);

create table public.chat_mutes (
  id uuid primary key default gen_random_uuid(),
  sender_ref text not null,
  muted_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);
create index chat_mutes_ref_idx on public.chat_mutes(sender_ref, muted_until);

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_ref text not null,
  reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert on public.congregation_profiles to anon, authenticated;
grant all on public.congregation_profiles to service_role;
grant select, insert, update, delete on public.approved_youth to authenticated;
grant all on public.approved_youth to service_role;
grant all on public.youth_sessions to service_role;
grant select, insert on public.chat_messages to anon, authenticated;
grant update, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
grant select, insert, delete on public.message_reactions to anon, authenticated;
grant all on public.message_reactions to service_role;
grant select, insert on public.message_receipts to anon, authenticated;
grant all on public.message_receipts to service_role;
grant select, insert, update, delete on public.chat_mutes to authenticated;
grant all on public.chat_mutes to service_role;
grant select, insert on public.chat_reports to anon, authenticated;
grant update, delete on public.chat_reports to authenticated;
grant all on public.chat_reports to service_role;

create or replace function public.current_youth_token()
returns text language sql stable security definer set search_path = public as $$
  select nullif(coalesce(current_setting('request.headers', true)::json ->> 'x-youth-token', ''), '')
$$;

create or replace function public.current_youth_id()
returns uuid language sql stable security definer set search_path = public as $$
  select s.youth_id from public.youth_sessions s
  where s.token = public.current_youth_token() and s.expires_at > now()
  limit 1
$$;

create or replace function public.can_read_message(_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_messages m
    where m.id = _id
      and (m.channel = 'congregation' or public.current_youth_id() is not null)
  )
$$;

revoke execute on function public.current_youth_token() from public;
revoke execute on function public.current_youth_id() from public;
revoke execute on function public.can_read_message(uuid) from public;
grant execute on function public.current_youth_id() to anon, authenticated;
grant execute on function public.can_read_message(uuid) to anon, authenticated;

create or replace function public.tg_chat_message_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if exists (select 1 from public.chat_mutes mu where mu.sender_ref = new.sender_ref and mu.muted_until > now()) then
    raise exception 'You are muted / आप म्यूट हैं';
  end if;
  select count(*) into recent from public.chat_messages m
    where m.sender_ref = new.sender_ref and m.created_at > now() - interval '1 minute';
  if recent >= 10 then
    raise exception 'Too many messages, slow down / बहुत अधिक संदेश';
  end if;
  return new;
end;
$$;
revoke execute on function public.tg_chat_message_guard() from public, anon, authenticated;
create trigger chat_messages_guard before insert on public.chat_messages
  for each row execute function public.tg_chat_message_guard();

create or replace function public.congregation_register(_name text, _email text, _phone text)
returns text language plpgsql security definer set search_path = public as $$
declare sid text;
begin
  sid := gen_random_uuid()::text;
  insert into public.congregation_profiles(device_session_id, name, email, phone)
  values (sid, _name, _email, _phone);
  return sid;
end;
$$;
revoke execute on function public.congregation_register(text, text, text) from public;
grant execute on function public.congregation_register(text, text, text) to anon, authenticated;

create or replace function public.youth_check_phone(_phone text)
returns table(token text, name text, youth_id uuid)
language plpgsql security definer set search_path = public as $$
declare y public.approved_youth%rowtype; tk text;
begin
  select * into y from public.approved_youth
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
    limit 1;
  if not found then return; end if;
  tk := encode(gen_random_bytes(24), 'hex');
  insert into public.youth_sessions(youth_id, token) values (y.id, tk);
  return query select tk, y.name, y.id;
end;
$$;
revoke execute on function public.youth_check_phone(text) from public;
grant execute on function public.youth_check_phone(text) to anon, authenticated;

alter table public.congregation_profiles enable row level security;
create policy "anyone can register" on public.congregation_profiles for insert to anon, authenticated with check (true);
create policy "super admins read profiles" on public.congregation_profiles for select to authenticated
  using (public.is_super_admin(auth.uid()));

alter table public.approved_youth enable row level security;
create policy "super admins manage youth" on public.approved_youth for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

alter table public.youth_sessions enable row level security;

alter table public.chat_messages enable row level security;
create policy "read chat messages" on public.chat_messages for select to anon, authenticated
  using (channel = 'congregation' or public.current_youth_id() is not null);
create policy "post congregation messages" on public.chat_messages for insert to anon, authenticated
  with check (
    channel = 'congregation'
    and exists (select 1 from public.congregation_profiles p where p.device_session_id = sender_ref)
  );
create policy "post youth messages" on public.chat_messages for insert to anon, authenticated
  with check (channel = 'youth' and sender_ref = public.current_youth_id()::text);
create policy "super admins moderate messages" on public.chat_messages for update to authenticated
  using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));
create policy "super admins delete messages" on public.chat_messages for delete to authenticated
  using (public.is_super_admin(auth.uid()));

alter table public.message_reactions enable row level security;
create policy "read reactions" on public.message_reactions for select to anon, authenticated
  using (public.can_read_message(message_id));
create policy "add reactions" on public.message_reactions for insert to anon, authenticated
  with check (public.can_read_message(message_id));
create policy "remove own reactions" on public.message_reactions for delete to anon, authenticated
  using (public.can_read_message(message_id));

alter table public.message_receipts enable row level security;
create policy "read receipts" on public.message_receipts for select to anon, authenticated
  using (public.can_read_message(message_id));
create policy "add receipts" on public.message_receipts for insert to anon, authenticated
  with check (public.can_read_message(message_id));

alter table public.chat_mutes enable row level security;
create policy "admins manage mutes" on public.chat_mutes for all to authenticated
  using (public.is_chat_admin(auth.uid()))
  with check (public.is_chat_admin(auth.uid()));

alter table public.chat_reports enable row level security;
create policy "anyone can report" on public.chat_reports for insert to anon, authenticated with check (true);
create policy "admins read reports" on public.chat_reports for select to authenticated
  using (public.is_chat_admin(auth.uid()));
create policy "admins update reports" on public.chat_reports for update to authenticated
  using (public.is_chat_admin(auth.uid()))
  with check (true);

alter table public.chat_messages replica identity full;
alter publication supabase_realtime add table public.chat_messages;
alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.message_reactions;

create policy "chat media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'chat-media');
create policy "chat media upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'chat-media');