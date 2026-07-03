
DROP POLICY IF EXISTS "Auth read book pages" ON storage.objects;
CREATE POLICY "Public read book pages" ON storage.objects
  FOR SELECT USING (bucket_id = 'book-pages');
