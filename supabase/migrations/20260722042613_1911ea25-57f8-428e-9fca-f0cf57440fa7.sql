DO $$ BEGIN
  CREATE TYPE public.song_category AS ENUM ('church', 'additional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS category public.song_category NOT NULL DEFAULT 'church';

CREATE INDEX IF NOT EXISTS songs_category_idx ON public.songs(category);