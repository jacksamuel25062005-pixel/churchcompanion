
-- Storage policies for about-media (private bucket, signed URLs for reads)
create policy "about-media read auth or anon signed"
on storage.objects for select
using (bucket_id = 'about-media');

create policy "about-media admin insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'about-media' and exists (
  select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')
));

create policy "about-media admin update"
on storage.objects for update to authenticated
using (bucket_id = 'about-media' and exists (
  select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')
));

create policy "about-media admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'about-media' and exists (
  select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')
));

-- About Church entries
create table public.about_church_entries (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_hi text,
  body_en text not null,
  body_hi text,
  photo_urls text[] not null default '{}',
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.about_church_entries to anon, authenticated;
grant insert, update, delete on public.about_church_entries to authenticated;
grant all on public.about_church_entries to service_role;
alter table public.about_church_entries enable row level security;

create policy "about entries public read published"
on public.about_church_entries for select
using (is_published = true or exists (
  select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')
));

create policy "about entries admin all"
on public.about_church_entries for all to authenticated
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')))
with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')));

create trigger set_updated_at before update on public.about_church_entries
for each row execute function public.tg_set_updated_at();

-- Timeline articles
create table public.church_timeline_articles (
  id uuid primary key default gen_random_uuid(),
  article_date date not null,
  title_en text not null,
  title_hi text,
  body_en text not null,
  body_hi text,
  photo_urls text[] not null default '{}',
  is_published boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_timeline_date on public.church_timeline_articles (article_date desc);
grant select on public.church_timeline_articles to anon, authenticated;
grant insert, update, delete on public.church_timeline_articles to authenticated;
grant all on public.church_timeline_articles to service_role;
alter table public.church_timeline_articles enable row level security;

create policy "timeline public read published"
on public.church_timeline_articles for select
using (is_published = true or exists (
  select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')
));

create policy "timeline admin all"
on public.church_timeline_articles for all to authenticated
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')))
with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')));

create trigger set_updated_at before update on public.church_timeline_articles
for each row execute function public.tg_set_updated_at();

-- Likes (anonymous, deduped by client id)
create table public.timeline_article_likes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.church_timeline_articles(id) on delete cascade,
  liker_client_id text not null,
  created_at timestamptz not null default now(),
  unique (article_id, liker_client_id)
);
grant select, insert, delete on public.timeline_article_likes to anon, authenticated;
grant all on public.timeline_article_likes to service_role;
alter table public.timeline_article_likes enable row level security;

create policy "likes public read"
on public.timeline_article_likes for select using (true);

create policy "likes public insert"
on public.timeline_article_likes for insert with check (true);

create policy "likes public delete"
on public.timeline_article_likes for delete using (true);

-- Comments (anonymous)
create table public.timeline_article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.church_timeline_articles(id) on delete cascade,
  commenter_name text not null,
  comment_text text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_comments_article on public.timeline_article_comments (article_id, created_at desc);
grant select, insert on public.timeline_article_comments to anon, authenticated;
grant update, delete on public.timeline_article_comments to authenticated;
grant all on public.timeline_article_comments to service_role;
alter table public.timeline_article_comments enable row level security;

create policy "comments public read visible"
on public.timeline_article_comments for select
using (is_hidden = false or exists (
  select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')
));

create policy "comments public insert"
on public.timeline_article_comments for insert with check (true);

create policy "comments admin update"
on public.timeline_article_comments for update to authenticated
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')))
with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')));

create policy "comments admin delete"
on public.timeline_article_comments for delete to authenticated
using (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin')));
