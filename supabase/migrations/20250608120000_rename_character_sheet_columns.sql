-- Character identity sheets are generated via OpenAI, not MuAPI.
alter table character_profiles
  rename column muapi_character_sheet_storage_path to character_sheet_storage_path;

alter table character_profiles
  rename column muapi_character_sheet_mime_type to character_sheet_mime_type;

alter table character_profiles
  rename column muapi_character_sheet_updated_at to character_sheet_updated_at;
