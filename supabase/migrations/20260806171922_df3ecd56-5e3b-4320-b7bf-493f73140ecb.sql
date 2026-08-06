create or replace function public.congregation_join(_name text, _phone text)
returns table(session_id text, name text, phone_number text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare p text;
begin
  perform public.validate_chat_input(_name, _phone);
  p := public.normalize_phone(_phone);
  insert into public.congregation_chat_users as u (phone_number, name)
  values (p, btrim(_name))
  on conflict on constraint congregation_chat_users_pkey do update
    set name = excluded.name, is_online = true, last_seen = now();
  return query select u.session_id, u.name, u.phone_number
    from public.congregation_chat_users u where u.phone_number = p;
end;
$$;

create or replace function public.youth_join(_phone text)
returns table(session_id text, name text, phone_number text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare p text; w public.youth_phone_whitelist%rowtype;
begin
  p := public.normalize_phone(_phone);
  if length(p) < 10 then raise exception 'Invalid phone number'; end if;
  select * into w from public.youth_phone_whitelist wl
    where public.normalize_phone(wl.phone_number) = p limit 1;
  if w.id is null then return; end if;
  insert into public.youth_chat_users as u (phone_number, name)
  values (p, w.name)
  on conflict on constraint youth_chat_users_pkey do update
    set name = excluded.name, is_online = true, last_seen = now();
  return query select u.session_id, u.name, u.phone_number
    from public.youth_chat_users u where u.phone_number = p;
end;
$$;

create or replace function public.chat_session_info(_chat text, _session text)
returns table(name text, phone_number text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if _chat = 'youth' then
    return query select u.name, u.phone_number from public.youth_chat_users u where u.session_id = _session;
  else
    return query select u.name, u.phone_number from public.congregation_chat_users u where u.session_id = _session;
  end if;
end;
$$;

revoke all on function public.congregation_join(text, text) from public;
revoke all on function public.youth_join(text) from public;
revoke all on function public.chat_session_info(text, text) from public;
grant execute on function public.congregation_join(text, text) to anon, authenticated;
grant execute on function public.youth_join(text) to anon, authenticated;
grant execute on function public.chat_session_info(text, text) to anon, authenticated;
