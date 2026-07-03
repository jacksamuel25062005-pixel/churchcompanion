
CREATE TABLE public.book_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  storage_path TEXT NOT NULL,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, page_number)
);
CREATE INDEX book_pages_book_idx ON public.book_pages(book_id, page_number);

GRANT SELECT ON public.book_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_pages TO authenticated;
GRANT ALL ON public.book_pages TO service_role;

ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view book pages" ON public.book_pages
  FOR SELECT USING (true);
CREATE POLICY "Admins insert book pages" ON public.book_pages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
CREATE POLICY "Admins update book pages" ON public.book_pages
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
CREATE POLICY "Admins delete book pages" ON public.book_pages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
