-- Setup script for the memoir-projects backend.
--
-- This file tightens the previous demo-only policies. It is still suitable
-- for a small public demo (anon key embedded in the SPA bundle), but
-- adds field-level checks so the table cannot be used as an open KV store
-- and the storage bucket cannot be hijacked to serve arbitrary content.
--
-- For real production traffic, you should also:
--   1. Move inserts behind a Supabase Edge Function that holds the
--      service-role key, instead of letting the SPA insert directly with
--      the anon key.
--   2. Add per-IP rate limiting via the Edge Function or pg_net.
--   3. Schedule a cleanup job (pg_cron) that deletes records and storage
--      objects older than N days.
-- These are out of scope for this SQL file but flagged here so they aren't forgotten.

create extension if not exists pgcrypto;

-- Storage bucket (public reads OK; the SPA needs to render the video)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memoirs',
  'memoirs',
  true,
  52428800,                                  -- 50 MB hard cap per object
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Project records
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
  created_at timestamptz not null default now(),

  -- Field-level constraints — enforced regardless of RLS path used.
  constraint share_id_format check (share_id ~ '^[a-z0-9]{8,32}$'),
  constraint title_length check (char_length(title) between 1 and 100),
  constraint intro_length check (intro is null or char_length(intro) <= 500),
  constraint ending_length check (ending is null or char_length(ending) <= 500),
  constraint media_count_range check (media_count between 0 and 200),
  constraint resolution_whitelist check (resolution is null or resolution in ('720p', '1080p')),
  -- video_path must live under the share_id "folder" inside the bucket
  constraint video_path_scope check (video_path like share_id || '/%'),
  -- video_url must be a Supabase public URL pointing at our own bucket
  constraint video_url_scope check (video_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/memoirs/')
);

alter table public.memoir_projects enable row level security;

-- Public read (anyone with a share link can render the page)
drop policy if exists "Public read memoir projects" on public.memoir_projects;
create policy "Public read memoir projects"
on public.memoir_projects
for select
using (true);

-- Anon insert — still allowed, but every column must pass the table-level
-- CHECK constraints above. Without a server key, this is the tightest we
-- can get without an Edge Function.
drop policy if exists "Anon insert memoir projects" on public.memoir_projects;
create policy "Anon insert memoir projects"
on public.memoir_projects
for insert
to anon
with check (
  -- redundant with table CHECKs but explicit at the policy level so a
  -- forgotten constraint can't accidentally widen the policy.
  share_id ~ '^[a-z0-9]{8,32}$'
  and char_length(title) between 1 and 100
  and char_length(coalesce(intro, '')) <= 500
  and char_length(coalesce(ending, '')) <= 500
  and media_count between 0 and 200
  and (resolution is null or resolution in ('720p', '1080p'))
  and video_path like share_id || '/%'
  and video_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/memoirs/'
);

-- No anon UPDATE / DELETE policies — without them, RLS denies by default.
-- This means anonymous clients can never modify or remove records.

-- Storage policies
drop policy if exists "Public read memoir videos" on storage.objects;
create policy "Public read memoir videos"
on storage.objects
for select
using (bucket_id = 'memoirs');

-- Anon upload — restricted to the memoirs bucket. Object name must match
-- "<share_id>/<filename>", so an attacker can't dump files at arbitrary
-- paths. file_size_limit and allowed_mime_types on the bucket itself
-- enforce per-object size and type.
drop policy if exists "Anon upload memoir videos" on storage.objects;
create policy "Anon upload memoir videos"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'memoirs'
  and name ~ '^[a-z0-9]{8,32}/[A-Za-z0-9._-]+$'
);
