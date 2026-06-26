export interface Book {
  id: string;
  slug: string;
  title_en: string;
  title_hi: string;
  description_en: string | null;
  description_hi: string | null;
  accent_color: string;
  sort_order: number;
}

export interface BookSection {
  id: string;
  book_id: string;
  number: number | null;
  title_hi: string | null;
  title_en: string | null;
  body_hi: string | null;
  body_en: string | null;
  sort_order: number;
}

export interface Song {
  id: string;
  number: number | null;
  title_hi: string;
  title_en: string | null;
  lyrics_hi: string;
  lyrics_en: string | null;
  tags: string[] | null;
}

export interface TodaySet {
  id: string;
  for_date: string;
  title: string | null;
  note: string | null;
  published_at: string;
}
