create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('memoirs', 'memoirs', true)
on conflict (id) do nothing;

create table if not exists public.memoir_projects (
  id uuid primary key default gen_random_uuid(),
  share_id text not null unique,
  title text not null,
  intro text,
  ending text,
  style_id text,
  style_name text,
  tone text,
  resolution text,
  media_count integer not null default 0,
  video_path text not null,
  video_url text not null,
  created_at timestamptz not null default now()
);

alter table public.memoir_projects enable row level security;

drop policy if exists "Public read memoir projects" on public.memoir_projects;
create policy "Public read memoir projects"
on public.memoir_projects
for select
using (true);

drop policy if exists "Anon insert memoir projects" on public.memoir_projects;
create policy "Anon insert memoir projects"
on public.memoir_projects
for insert
to anon
with check (true);

drop policy if exists "Public read memoir videos" on storage.objects;
create policy "Public read memoir videos"
on storage.objects
for select
using (bucket_id = 'memoirs');

drop policy if exists "Anon upload memoir videos" on storage.objects;
create policy "Anon upload memoir videos"
on storage.objects
for insert
to anon
with check (bucket_id = 'memoirs');
