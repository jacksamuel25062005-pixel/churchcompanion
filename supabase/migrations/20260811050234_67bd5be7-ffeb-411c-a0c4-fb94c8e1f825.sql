DROP POLICY IF EXISTS "chat media read" ON storage.objects;
CREATE POLICY "chat media read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'chat-media'
  AND (
    public.is_chat_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.media_url = storage.objects.name
        AND (
          (m.channel = 'congregation' AND public.has_congregation_session())
          OR (m.channel = 'youth' AND public.has_youth_session())
        )
    )
  )
);

DROP POLICY IF EXISTS "Chat members can read reactions" ON public.chat_message_reactions;
CREATE POLICY "Chat members can read reactions" ON public.chat_message_reactions
FOR SELECT
USING (
  public.is_chat_admin(auth.uid())
  OR (chat = 'congregation' AND public.has_congregation_session())
  OR (chat = 'youth' AND public.has_youth_session())
);