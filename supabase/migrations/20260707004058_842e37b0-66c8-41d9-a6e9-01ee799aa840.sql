ALTER TABLE public.almanac_entries
  ADD COLUMN IF NOT EXISTS memorial text,
  ADD COLUMN IF NOT EXISTS ls_ot text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ls_psalm text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ls_second text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ls_gospel text[] NOT NULL DEFAULT '{}';