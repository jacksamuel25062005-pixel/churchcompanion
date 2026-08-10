-- 1. Require a verified session to read chat messages
DROP POLICY IF EXISTS "read chat messages" ON public.chat_messages;
CREATE POLICY "read chat messages" ON public.chat_messages
FOR SELECT
USING (
  public.is_chat_admin(auth.uid())
  OR (
    deleted = false
    AND (
      (channel = 'congregation' AND (public.has_congregation_session() OR public.current_congregation_ref() IS NOT NULL))
      OR (channel = 'youth' AND (public.has_youth_session() OR public.current_youth_id() IS NOT NULL))
    )
  )
);

-- 2. can_read_message must apply the same session gate
CREATE OR REPLACE FUNCTION public.can_read_message(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.chat_messages m
    where m.id = _id
      and (
        public.is_chat_admin(auth.uid())
        or (m.channel = 'congregation' and (public.has_congregation_session() or public.current_congregation_ref() is not null))
        or (m.channel = 'youth' and (public.has_youth_session() or public.current_youth_id() is not null))
      )
  )
$function$;

-- 3. Revoke execute on unused internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.youth_check_phone(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.youth_refresh_session(text) FROM anon, authenticated;