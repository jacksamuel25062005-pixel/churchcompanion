CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT now() $$;
REVOKE EXECUTE ON FUNCTION public.server_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated;