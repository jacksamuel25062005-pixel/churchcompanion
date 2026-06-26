
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_admin_request_decision() FROM PUBLIC, anon, authenticated, service_role;
