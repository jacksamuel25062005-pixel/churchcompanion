GRANT EXECUTE ON FUNCTION public.is_chat_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.youth_check_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.youth_refresh_session(text) TO anon, authenticated;