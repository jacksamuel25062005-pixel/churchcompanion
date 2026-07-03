
CREATE POLICY "Auth read book pages" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'book-pages');
CREATE POLICY "Admins upload book pages" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'book-pages' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
CREATE POLICY "Admins modify book pages" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'book-pages' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
CREATE POLICY "Admins remove book pages" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'book-pages' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin')));
