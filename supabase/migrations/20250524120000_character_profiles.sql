-- Character profiles: reusable mascot identity (anchor refs + art direction + voice + saved frame-sequence-sheet).
create table if not exists public.character_profiles (
  id uuid primary key,
  name text not null,
  art_direction text not null default '',
  reference_image_ids jsonb not null default '[]'::jsonb,
  voice_sample_path text,
  voice_sample_mime text,
  voice_sample_name text,
  sheet_storage_path text,
  sheet_mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists character_profiles_created_at_idx on public.character_profiles (created_at desc);
create index if not exists character_profiles_user_id_idx on public.character_profiles (user_id);

alter table public.character_profiles enable row level security;

revoke all on table public.character_profiles from anon;
revoke all on table public.character_profiles from authenticated;


-- Private Storage bucket for profile voice samples and saved frame-sequence-sheets.
insert into storage.buckets (id, name, public)
values ('character-assets', 'character-assets', false)
on conflict (id) do nothing;
