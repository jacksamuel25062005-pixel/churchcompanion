ALTER TABLE public.approved_youth REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approved_youth;