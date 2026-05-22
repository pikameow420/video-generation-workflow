-- Persisted entities (no permissive anon/authenticated access; API uses service_role).
create table if not exists public.saved_scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  source text not null check (source in ('generated', 'manual', 'uploaded')),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists saved_scripts_created_at_idx on public.saved_scripts (created_at desc);

alter table public.saved_scripts enable row level security;

revoke all on table public.saved_scripts from anon;
revoke all on table public.saved_scripts from authenticated;


create table if not exists public.reference_images (
  id uuid primary key,
  storage_path text not null unique,
  mime_type text not null,
  bytes bigint not null,
  original_name text not null,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists reference_images_created_at_idx on public.reference_images (created_at desc);

alter table public.reference_images enable row level security;

revoke all on table public.reference_images from anon;
revoke all on table public.reference_images from authenticated;


create table if not exists public.pipeline_videos (
  id text primary key,
  storage_path text not null unique,
  bytes bigint not null,
  has_captions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists pipeline_videos_updated_at_idx on public.pipeline_videos (updated_at desc);

alter table public.pipeline_videos enable row level security;

revoke all on table public.pipeline_videos from anon;
revoke all on table public.pipeline_videos from authenticated;


-- Private Storage buckets (object keys are bucket-relative).
insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('pipeline-videos', 'pipeline-videos', false)
on conflict (id) do nothing;
