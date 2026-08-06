-- ============ helpers ============
create or replace function public.current_chat_session()
returns text language sql stable security definer set search_path = public as $$
  select nullif(coalesce(current_setting('request.headers', true)::json ->> 'x-chat-session', ''), '')
$$;

create or replace function public.normalize_phone(_p text)
returns text language sql immutable set search_path = public as $$
  select right(regexp_replace(coalesce(_p,''), '\D', '', 'g'), 10)
$$;

-- ============ tables ============
create table public.congregation_chat_users (
  phone_number text primary key,
  name text not null,
  session_id text not null unique default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  is_online boolean not null default true,
  last_seen timestamptz not null default now(),
  joined_at timestamptz not null default now()
);
grant select on public.congregation_chat_users to anon, authenticated;
grant all on public.congregation_chat_users to service_role;
alter table public.congregation_chat_users enable row level security;

create table public.congregation_chat_messages (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null references public.congregation_chat_users(phone_number) on delete cascade,
  sender_name text not null,
  message_content text not null,
  created_at timestamptz not null default now(),
  is_edited boolean not null default false,
  edited_at timestamptz
);
create index idx_cong_msgs_created on public.congregation_chat_messages(created_at desc);
grant select on public.congregation_chat_messages to anon, authenticated;
grant all on public.congregation_chat_messages to service_role;
alter table public.congregation_chat_messages enable row level security;

create table public.youth_phone_whitelist (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  name text not null,
  added_by uuid references auth.users(id),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.youth_phone_whitelist to authenticated;
grant all on public.youth_phone_whitelist to service_role;
alter table public.youth_phone_whitelist enable row level security;

create table public.youth_chat_users (
  phone_number text primary key,
  name text not null,
  session_id text not null unique default replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
  is_online boolean not null default true,
  last_seen timestamptz not null default now(),
  joined_at timestamptz not null default now()
);
grant select on public.youth_chat_users to anon, authenticated;
grant all on public.youth_chat_users to service_role;
alter table public.youth_chat_users enable row level security;

create table public.youth_chat_messages (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null references public.youth_chat_users(phone_number) on delete cascade,
  sender_name text not null,
  message_content text not null,
  created_at timestamptz not null default now(),
  is_edited boolean not null default false,
  edited_at timestamptz
);
create index idx_youth_msgs_created on public.youth_chat_messages(created_at desc);
grant select on public.youth_chat_messages to anon, authenticated;
grant all on public.youth_chat_messages to service_role;
alter table public.youth_chat_messages enable row level security;

create table public.youth_access_requests (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  name text not null,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index idx_youth_req_status on public.youth_access_requests(status, created_at desc);
grant select, update on public.youth_access_requests to authenticated;
grant all on public.youth_access_requests to service_role;
alter table public.youth_access_requests enable row level security;

-- ============ session predicates ============
create or replace function public.has_congregation_session()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.congregation_chat_users u where u.session_id = public.current_chat_session())
$$;

create or replace function public.has_youth_session()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.youth_chat_users u where u.session_id = public.current_chat_session())
$$;

-- ============ policies ============
create policy "cong users readable to members" on public.congregation_chat_users
  for select using (public.has_congregation_session() or public.is_chat_admin(auth.uid()));
create policy "cong msgs readable to members" on public.congregation_chat_messages
  for select using (public.has_congregation_session() or public.is_chat_admin(auth.uid()));

create policy "youth users readable to members" on public.youth_chat_users
  for select using (public.has_youth_session() or public.is_chat_admin(auth.uid()));
create policy "youth msgs readable to members" on public.youth_chat_messages
  for select using (public.has_youth_session() or public.is_chat_admin(auth.uid()));

create policy "admins manage whitelist" on public.youth_phone_whitelist
  for all to authenticated using (public.is_chat_admin(auth.uid())) with check (public.is_chat_admin(auth.uid()));

create policy "admins read requests" on public.youth_access_requests
  for select to authenticated using (public.is_chat_admin(auth.uid()));
create policy "admins update requests" on public.youth_access_requests
  for update to authenticated using (public.is_chat_admin(auth.uid())) with check (public.is_chat_admin(auth.uid()));

-- ============ validation ============
create or replace function public.validate_chat_input(_name text, _phone text)
returns void language plpgsql immutable set search_path = public as $$
declare d text;
begin
  d := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  if length(d) < 10 or length(d) > 13 then raise exception 'Invalid phone number'; end if;
  if length(btrim(coalesce(_name,''))) < 2 or length(btrim(_name)) > 50 then raise exception 'Name must be 2-50 characters'; end if;
end;
$$;

-- ============ join / session ============
create or replace function public.congregation_join(_name text, _phone text)
returns table(session_id text, name text, phone_number text)
language plpgsql security definer set search_path = public, extensions as $$
declare p text;
begin
  perform public.validate_chat_input(_name, _phone);
  p := public.normalize_phone(_phone);
  insert into public.congregation_chat_users(phone_number, name)
  values (p, btrim(_name))
  on conflict (phone_number) do update
    set name = excluded.name, is_online = true, last_seen = now();
  return query select u.session_id, u.name, u.phone_number
    from public.congregation_chat_users u where u.phone_number = p;
end;
$$;

create or replace function public.youth_join(_phone text)
returns table(session_id text, name text, phone_number text)
language plpgsql security definer set search_path = public, extensions as $$
declare p text; w public.youth_phone_whitelist%rowtype;
begin
  p := public.normalize_phone(_phone);
  if length(p) < 10 then raise exception 'Invalid phone number'; end if;
  select * into w from public.youth_phone_whitelist
    where public.normalize_phone(phone_number) = p limit 1;
  if not found then return; end if;
  insert into public.youth_chat_users(phone_number, name)
  values (p, w.name)
  on conflict (phone_number) do update set name = excluded.name, is_online = true, last_seen = now();
  return query select u.session_id, u.name, u.phone_number
    from public.youth_chat_users u where u.phone_number = p;
end;
$$;

create or replace function public.chat_session_info(_chat text, _session text)
returns table(name text, phone_number text)
language plpgsql stable security definer set search_path = public as $$
begin
  if _chat = 'youth' then
    return query select u.name, u.phone_number from public.youth_chat_users u where u.session_id = _session;
  else
    return query select u.name, u.phone_number from public.congregation_chat_users u where u.session_id = _session;
  end if;
end;
$$;

-- ============ send message (rate limited) ============
create or replace function public.chat_send(_chat text, _content text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s text; p text; n text; last timestamptz; new_id uuid;
begin
  s := public.current_chat_session();
  if s is null then raise exception 'No chat session'; end if;
  if length(btrim(coalesce(_content,''))) = 0 then raise exception 'Empty message'; end if;
  if length(_content) > 500 then raise exception 'Message too long (max 500)'; end if;

  if _chat = 'youth' then
    select u.phone_number, u.name into p, n from public.youth_chat_users u where u.session_id = s;
    if p is null then raise exception 'No chat session'; end if;
    select max(m.created_at) into last from public.youth_chat_messages m where m.phone_number = p;
    if last is not null and last > now() - interval '1 second' then raise exception 'Slow down'; end if;
    insert into public.youth_chat_messages(phone_number, sender_name, message_content)
    values (p, n, btrim(_content)) returning id into new_id;
    update public.youth_chat_users set last_seen = now(), is_online = true where phone_number = p;
  else
    select u.phone_number, u.name into p, n from public.congregation_chat_users u where u.session_id = s;
    if p is null then raise exception 'No chat session'; end if;
    select max(m.created_at) into last from public.congregation_chat_messages m where m.phone_number = p;
    if last is not null and last > now() - interval '1 second' then raise exception 'Slow down'; end if;
    insert into public.congregation_chat_messages(phone_number, sender_name, message_content)
    values (p, n, btrim(_content)) returning id into new_id;
    update public.congregation_chat_users set last_seen = now(), is_online = true where phone_number = p;
  end if;
  return new_id;
end;
$$;

-- ============ heartbeat ============
create or replace function public.chat_heartbeat(_chat text)
returns void language plpgsql security definer set search_path = public as $$
declare s text;
begin
  s := public.current_chat_session();
  if s is null then return; end if;
  if _chat = 'youth' then
    update public.youth_chat_users set last_seen = now(), is_online = true where session_id = s;
    update public.youth_chat_users set is_online = false where last_seen < now() - interval '60 seconds' and is_online;
  else
    update public.congregation_chat_users set last_seen = now(), is_online = true where session_id = s;
    update public.congregation_chat_users set is_online = false where last_seen < now() - interval '60 seconds' and is_online;
  end if;
end;
$$;

-- ============ access requests ============
create or replace function public.youth_request_access(_name text, _phone text, _message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare p text; recent int; daily int;
begin
  perform public.validate_chat_input(_name, _phone);
  if length(coalesce(_message,'')) > 500 then raise exception 'Message too long (max 500)'; end if;
  p := public.normalize_phone(_phone);
  if exists (select 1 from public.youth_phone_whitelist w where public.normalize_phone(w.phone_number) = p) then
    return 'already_approved';
  end if;
  select count(*) into recent from public.youth_access_requests r
    where public.normalize_phone(r.phone_number) = p and r.created_at > now() - interval '24 hours';
  if recent > 0 then raise exception 'You already requested access in the last 24 hours'; end if;
  select count(*) into daily from public.youth_access_requests r where r.created_at > now() - interval '24 hours';
  if daily >= 500 then raise exception 'Too many requests today, please try again later'; end if;
  insert into public.youth_access_requests(phone_number, name, message)
  values (p, btrim(_name), nullif(btrim(coalesce(_message,'')), ''));
  return 'pending';
end;
$$;

create or replace function public.youth_request_status(_phone text)
returns table(status text, rejection_reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.status, r.rejection_reason, r.created_at
  from public.youth_access_requests r
  where public.normalize_phone(r.phone_number) = public.normalize_phone(_phone)
  order by r.created_at desc limit 1
$$;

create or replace function public.youth_review_request(_id uuid, _approve boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.youth_access_requests%rowtype;
begin
  if not public.is_chat_admin(auth.uid()) then raise exception 'Forbidden'; end if;
  select * into r from public.youth_access_requests where id = _id;
  if not found then raise exception 'Request not found'; end if;
  if _approve then
    insert into public.youth_phone_whitelist(phone_number, name, added_by, source)
    values (r.phone_number, r.name, auth.uid(), 'request')
    on conflict (phone_number) do nothing;
    update public.youth_access_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null
      where id = _id;
  else
    update public.youth_access_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = _reason
      where id = _id;
  end if;
end;
$$;

-- ============ execute grants ============
revoke all on function public.congregation_join(text, text) from public;
revoke all on function public.youth_join(text) from public;
revoke all on function public.chat_send(text, text) from public;
revoke all on function public.chat_heartbeat(text) from public;
revoke all on function public.youth_request_access(text, text, text) from public;
revoke all on function public.youth_request_status(text) from public;
revoke all on function public.youth_review_request(uuid, boolean, text) from public;
revoke all on function public.chat_session_info(text, text) from public;
revoke all on function public.has_congregation_session() from public;
revoke all on function public.has_youth_session() from public;
revoke all on function public.current_chat_session() from public;
revoke all on function public.validate_chat_input(text, text) from public;

grant execute on function public.congregation_join(text, text) to anon, authenticated;
grant execute on function public.youth_join(text) to anon, authenticated;
grant execute on function public.chat_send(text, text) to anon, authenticated;
grant execute on function public.chat_heartbeat(text) to anon, authenticated;
grant execute on function public.youth_request_access(text, text, text) to anon, authenticated;
grant execute on function public.youth_request_status(text) to anon, authenticated;
grant execute on function public.chat_session_info(text, text) to anon, authenticated;
grant execute on function public.youth_review_request(uuid, boolean, text) to authenticated;
grant execute on function public.normalize_phone(text) to anon, authenticated;

-- realtime
alter publication supabase_realtime add table public.congregation_chat_messages;
alter publication supabase_realtime add table public.youth_chat_messages;
alter publication supabase_realtime add table public.youth_access_requests;
