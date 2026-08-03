CREATE OR REPLACE FUNCTION public.youth_check_phone(_phone text)
 RETURNS TABLE(token text, name text, youth_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare y public.approved_youth%rowtype; tk text;
begin
  select * into y from public.approved_youth
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
    limit 1;
  if not found then return; end if;
  tk := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.youth_sessions(youth_id, token) values (y.id, tk);
  return query select tk, y.name, y.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.youth_refresh_session(_token text)
 RETURNS TABLE(token text, name text, youth_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare s public.youth_sessions%rowtype; y public.approved_youth%rowtype;
begin
  select * into s from public.youth_sessions where youth_sessions.token = _token limit 1;
  if not found then return; end if;
  select * into y from public.approved_youth where id = s.youth_id;
  if not found then
    delete from public.youth_sessions where id = s.id;
    return;
  end if;
  update public.youth_sessions set expires_at = now() + interval '90 days' where id = s.id;
  return query select s.token, y.name, y.id;
end;
$function$;

REVOKE ALL ON FUNCTION public.youth_refresh_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youth_refresh_session(text) TO anon, authenticated, service_role;