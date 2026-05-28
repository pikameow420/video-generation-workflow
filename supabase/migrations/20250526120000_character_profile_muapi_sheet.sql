-- MuAPI character sheet fields on character profiles.
alter table public.character_profiles
  add column if not exists muapi_character_request_id text,
  add column if not exists muapi_character_sheet_storage_path text,
  add column if not exists muapi_character_sheet_mime_type text,
  add column if not exists muapi_character_sheet_updated_at timestamptz;
