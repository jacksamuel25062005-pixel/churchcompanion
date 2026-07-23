
REVOKE EXECUTE ON FUNCTION public.handle_admin_request_decision() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unlike_timeline_article(uuid, text) FROM PUBLIC, anon;
