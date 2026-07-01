
-- Announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  date DATE NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL CHECK (audience IN ('ChurchMembers','YouthGroup')),
  published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_published" ON public.announcements FOR SELECT
USING (published = true OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));

CREATE POLICY "announcements_insert_admins" ON public.announcements FOR INSERT
WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));

CREATE POLICY "announcements_update_admins" ON public.announcements FOR UPDATE
USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'))
WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));

CREATE POLICY "announcements_delete_admins" ON public.announcements FOR DELETE
USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));

-- Almanac
CREATE TABLE public.almanac_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  day_name TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  colour TEXT NOT NULL DEFAULT 'G' CHECK (colour IN ('W','G','V','R')),
  morning_readings TEXT[] NOT NULL DEFAULT '{}',
  evening_readings TEXT[] NOT NULL DEFAULT '{}',
  is_sunday BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.almanac_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.almanac_entries TO authenticated;
GRANT ALL ON public.almanac_entries TO service_role;
ALTER TABLE public.almanac_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "almanac_select_all" ON public.almanac_entries FOR SELECT USING (true);
CREATE POLICY "almanac_insert_admins" ON public.almanac_entries FOR INSERT
WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "almanac_update_admins" ON public.almanac_entries FOR UPDATE
USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'))
WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "almanac_delete_admins" ON public.almanac_entries FOR DELETE
USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_announcements_touch BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_almanac_touch BEFORE UPDATE ON public.almanac_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
