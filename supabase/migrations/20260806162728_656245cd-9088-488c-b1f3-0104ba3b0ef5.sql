create or replace function public.congregation_register(_name text, _email text, _phone text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare sid text;
begin
  sid := gen_random_uuid()::text;
  insert into public.congregation_profiles(device_session_id, name, email, phone, session_token)
  values (sid, _name, _email, _phone, sid);
  return sid;
end;
$function$;