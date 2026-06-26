
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin');
CREATE TYPE public.admin_request_status AS ENUM ('pending', 'approved', 'rejected');

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========== USER ROLES ===========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
$$;

CREATE POLICY "Users can see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- =========== AUTO PROFILE + SUPER ADMIN GRANT ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'emanualmridha2@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== BOOKS ===========
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_hi TEXT NOT NULL,
  description_en TEXT,
  description_hi TEXT,
  accent_color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.books TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Books are public" ON public.books FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage books" ON public.books FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- =========== BOOK SECTIONS ===========
CREATE TABLE public.book_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  number INT,
  title_hi TEXT,
  title_en TEXT,
  body_hi TEXT,
  body_en TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title_hi,'') || ' ' || coalesce(title_en,'') || ' ' || coalesce(body_hi,'') || ' ' || coalesce(body_en,''))
  ) STORED
);
CREATE INDEX book_sections_book_idx ON public.book_sections(book_id, sort_order);
CREATE INDEX book_sections_search_idx ON public.book_sections USING GIN(search);
GRANT SELECT ON public.book_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_sections TO authenticated;
GRANT ALL ON public.book_sections TO service_role;
ALTER TABLE public.book_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sections public" ON public.book_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage sections" ON public.book_sections FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- =========== SONGS ===========
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT,
  title_hi TEXT NOT NULL,
  title_en TEXT,
  lyrics_hi TEXT NOT NULL,
  lyrics_en TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title_hi,'') || ' ' || coalesce(title_en,'') || ' ' || coalesce(lyrics_hi,'') || ' ' || coalesce(lyrics_en,'') || ' ' || coalesce(number::text,''))
  ) STORED
);
CREATE INDEX songs_number_idx ON public.songs(number);
CREATE INDEX songs_search_idx ON public.songs USING GIN(search);
GRANT SELECT ON public.songs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Songs public" ON public.songs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage songs" ON public.songs FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- =========== TODAY'S SONG SETS ===========
CREATE TABLE public.today_song_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  for_date DATE NOT NULL,
  title TEXT,
  note TEXT,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX today_song_sets_date_idx ON public.today_song_sets(for_date DESC);
GRANT SELECT ON public.today_song_sets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.today_song_sets TO authenticated;
GRANT ALL ON public.today_song_sets TO service_role;
ALTER TABLE public.today_song_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Today sets public" ON public.today_song_sets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage today sets" ON public.today_song_sets FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE public.today_song_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.today_song_sets(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX today_song_items_set_idx ON public.today_song_items(set_id, position);
GRANT SELECT ON public.today_song_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.today_song_items TO authenticated;
GRANT ALL ON public.today_song_items TO service_role;
ALTER TABLE public.today_song_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Today items public" ON public.today_song_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage today items" ON public.today_song_items FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- =========== ADMIN REQUESTS ===========
CREATE TABLE public.admin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status public.admin_request_status NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_requests TO authenticated;
GRANT ALL ON public.admin_requests TO service_role;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own requests" ON public.admin_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users create own requests" ON public.admin_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins decide requests" ON public.admin_requests FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Approving a request grants admin role
CREATE OR REPLACE FUNCTION public.handle_admin_request_decision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_request_decision
AFTER UPDATE ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_admin_request_decision();

-- =========== AUDIT LOGS ===========
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins write audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()) AND auth.uid() = actor_id);

-- =========== APP SETTINGS ===========
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings public read" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- =========== SEARCH FUNCTION ===========
CREATE OR REPLACE FUNCTION public.search_content(q TEXT)
RETURNS TABLE (
  kind TEXT,
  id UUID,
  title TEXT,
  snippet TEXT,
  book_slug TEXT,
  number INT
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
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
GRANT EXECUTE ON FUNCTION public.search_content(TEXT) TO anon, authenticated;

-- =========== REALTIME ===========
ALTER PUBLICATION supabase_realtime ADD TABLE public.today_song_sets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.today_song_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;

-- =========== SEED BOOKS ===========
INSERT INTO public.books (slug, title_en, title_hi, accent_color, sort_order) VALUES
  ('song-book',     'Song Book',              'गीत पुस्तक',                  '#6366f1', 1),
  ('lords-supper',  'Lord''s Supper',         'प्रभु भोज',                    '#b91c1c', 2),
  ('ashaya-rabbani','Ashaya Rabbani',         'आशाय रब्बानी',                  '#0d9488', 3),
  ('prata-sayan',   'Prata Kaal & Sayan Kalin','प्रात:काल और सायं कालीन',     '#d97706', 4),
  ('almanac',       'Almanac',                'पंचांग',                        '#7c3aed', 5)
ON CONFLICT (slug) DO NOTHING;
