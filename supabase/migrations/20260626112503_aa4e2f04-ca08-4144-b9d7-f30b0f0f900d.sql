
-- 1. Move role-check helpers to a private schema not exposed by the API
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin_or_super(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin_or_super(uuid) TO authenticated, service_role;

-- 2. Recreate policies to use the private helpers
DROP POLICY IF EXISTS "Super admin manages roles" ON public.user_roles;
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins manage books" ON public.books;
CREATE POLICY "Admins manage books" ON public.books FOR ALL
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins manage sections" ON public.book_sections;
CREATE POLICY "Admins manage sections" ON public.book_sections FOR ALL
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins manage songs" ON public.songs;
CREATE POLICY "Admins manage songs" ON public.songs FOR ALL
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins manage today sets" ON public.today_song_sets;
CREATE POLICY "Admins manage today sets" ON public.today_song_sets FOR ALL
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins manage today items" ON public.today_song_items;
CREATE POLICY "Admins manage today items" ON public.today_song_items FOR ALL
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Users see own requests" ON public.admin_requests;
CREATE POLICY "Users see own requests" ON public.admin_requests FOR SELECT
  USING ((auth.uid() = user_id) OR private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins decide requests" ON public.admin_requests;
CREATE POLICY "Admins decide requests" ON public.admin_requests FOR UPDATE
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins read audit" ON public.audit_logs;
CREATE POLICY "Admins read audit" ON public.audit_logs FOR SELECT
  USING (private.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS "Admins write audit" ON public.audit_logs;
CREATE POLICY "Admins write audit" ON public.audit_logs FOR INSERT
  WITH CHECK (private.is_admin_or_super(auth.uid()) AND auth.uid() = actor_id);

DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL
  USING (private.is_admin_or_super(auth.uid())) WITH CHECK (private.is_admin_or_super(auth.uid()));

-- 3. Drop the old public role helpers (no longer used by policies)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_admin_or_super(uuid);

-- 4. Convert search_content to SECURITY INVOKER (RLS on songs/sections still allows anon reads)
CREATE OR REPLACE FUNCTION public.search_content(q text)
RETURNS TABLE(kind text, id uuid, title text, snippet text, book_slug text, number integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT 'song'::TEXT, s.id, COALESCE(s.title_hi, s.title_en, ''),
    LEFT(s.lyrics_hi, 200), 'song-book'::TEXT, s.number
  FROM public.songs s
  WHERE s.search @@ plainto_tsquery('simple', q) OR s.number::TEXT = q
  UNION ALL
  SELECT 'section'::TEXT, bs.id, COALESCE(bs.title_hi, bs.title_en, ''),
    LEFT(COALESCE(bs.body_hi, bs.body_en), 200), b.slug, bs.number
  FROM public.book_sections bs
  JOIN public.books b ON b.id = bs.book_id
  WHERE bs.search @@ plainto_tsquery('simple', q)
  LIMIT 200;
$$;

-- 5. Lock down trigger functions — only triggers (table-owner context) need to call them
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_admin_request_decision() FROM PUBLIC;

-- 6. Remove hardcoded super-admin email from the signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7. One-time grant of super_admin to the existing designated account, if it exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users WHERE email = 'emanualmridha2@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
