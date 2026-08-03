CREATE OR REPLACE FUNCTION public.youth_check_phone(_phone text)
 RETURNS TABLE(token text, name text, youth_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare y public.approved_youth%rowtype; tk text; d text;
begin
  d := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  if length(d) < 6 then return; end if;
  d := right(d, 10);
  select * into y from public.approved_youth
    where right(regexp_replace(phone, '\D', '', 'g'), 10) = d
    limit 1;
  if not found then return; end if;
  tk := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.youth_sessions(youth_id, token) values (y.id, tk);
  return query select tk, y.name, y.id;
end;
$function$;