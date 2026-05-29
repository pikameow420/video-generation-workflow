import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createStorageSignedUrl,
  removeStorageObject,
  uploadStorageObject,
} from "@/lib/supabase/storage";
import { normalizeIds } from "@/lib/character-profiles/profile-ids";
import { resolveReferenceImages } from "@/lib/character-profiles/reference-resolve";
import {
  buildReferenceImageMap,
  type ReferenceImageRecord,
} from "@/lib/uploads/store";
import {
  characterProfileSchema,
  type CharacterProfile,
  type CharacterProfileReference,
} from "@/lib/schemas";

export type CreateCharacterProfileInput = {
  name: string;
  artDirection: string;
  referenceImageIds: string[];
  voiceSample?: {
    bytes: Uint8Array;
    mimeType: string;
    originalName: string;
  } | null;
};

export type UpdateCharacterProfileInput = {
  name: string;
  artDirection: string;
  referenceImageIds: string[];
  /** Replaces the stored sample when set; ignored if `removeVoiceSample` is true. */
  voiceSample?: {
    bytes: Uint8Array;
    mimeType: string;
    originalName: string;
  } | null;
  /** Clears the stored sample without uploading a replacement. */
  removeVoiceSample?: boolean;
};

export type SaveProfileSheetImageInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export class CharacterProfileNotFoundError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Character profile not found: ${id}`);
    this.name = "CharacterProfileNotFoundError";
    this.id = id;
  }
}

/** Stored row shape (local JSON index and the Supabase table both map to this). */
type StoredCharacterProfile = {
  id: string;
  name: string;
  artDirection: string;
  referenceImageIds: string[];
  voiceSamplePath: string | null;
  voiceSampleMime: string | null;
  voiceSampleName: string | null;
  sheetStoragePath: string | null;
  sheetMimeType: string | null;
  muapiCharacterRequestId?: string | null;
  muapiCharacterSheetStoragePath?: string | null;
  muapiCharacterSheetMimeType?: string | null;
  muapiCharacterSheetUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveCharacterProfileSheetInput = {
  requestId: string | null;
  bytes: Uint8Array;
  mimeType: string;
};

/** @deprecated Use SaveCharacterProfileSheetInput */
export type SaveMuapiCharacterSheetInput = SaveCharacterProfileSheetInput;

function referenceIdsChanged(
  before: string[],
  after: string[],
): boolean {
  if (before.length !== after.length) return true;
  const a = [...before].sort();
  const b = [...after].sort();
  return a.some((id, i) => id !== b[i]);
}

async function clearMuapiCharacterSheetLocal(stored: StoredCharacterProfile): Promise<void> {
  if (stored.muapiCharacterSheetStoragePath) {
    await removeLocalAsset(stored.muapiCharacterSheetStoragePath);
  }
  stored.muapiCharacterRequestId = null;
  stored.muapiCharacterSheetStoragePath = null;
  stored.muapiCharacterSheetMimeType = null;
  stored.muapiCharacterSheetUpdatedAt = null;
}

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
};

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function audioExtFromMime(mimeType: string): string {
  return AUDIO_MIME_TO_EXT[mimeType.toLowerCase()] ?? "bin";
}

function imageExtFromMime(mimeType: string): string {
  return IMAGE_MIME_TO_EXT[mimeType.toLowerCase()] ?? "bin";
}

function sanitizeFileBase(input: string): string {
  const base = path.basename(input, path.extname(input));
  const clean = base.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "voice";
}

type VoiceStoredFields = {
  path: string | null;
  mime: string | null;
  name: string | null;
};

type VoiceUploadAdapter = {
  uploadReplacement: (args: {
    id: string;
    voice: NonNullable<UpdateCharacterProfileInput["voiceSample"]>;
  }) => Promise<string>;
  removeVoiceAtPath: (objectPath: string) => Promise<void>;
};

async function applyVoiceSampleMutation(
  profileId: string,
  current: VoiceStoredFields,
  input: UpdateCharacterProfileInput,
  adapter: VoiceUploadAdapter,
): Promise<VoiceStoredFields> {
  const replacingVoice = Boolean(input.voiceSample);
  const clearingVoice = !replacingVoice && Boolean(input.removeVoiceSample);

  if (replacingVoice && input.voiceSample) {
    const newPath = await adapter.uploadReplacement({
      id: profileId,
      voice: input.voiceSample,
    });
    if (current.path && current.path !== newPath) {
      try {
        await adapter.removeVoiceAtPath(current.path);
      } catch {
        /* tolerate missing blob */
      }
    }
    return {
      path: newPath,
      mime: input.voiceSample.mimeType,
      name: input.voiceSample.originalName,
    };
  }

  if (clearingVoice) {
    if (current.path) {
      try {
        await adapter.removeVoiceAtPath(current.path);
      } catch {
        /* tolerate missing blob */
      }
    }
    return { path: null, mime: null, name: null };
  }

  return current;
}

function asIso(ts: unknown): string {
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return new Date(ts as never).toISOString();
}

// --- Local JSON index fallback -------------------------------------------------

async function readIndex(indexPath: string): Promise<StoredCharacterProfile[]> {
  try {
    const content = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(content) as StoredCharacterProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeIndex(records: StoredCharacterProfile[]): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.CHARACTER_PROFILE_INDEX_PATH);
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, JSON.stringify(records, null, 2), "utf8");
}

async function readLocalIndex(): Promise<StoredCharacterProfile[]> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.CHARACTER_PROFILE_INDEX_PATH);
  return readIndex(indexPath);
}

async function writeLocalAsset(fileName: string, bytes: Uint8Array): Promise<string> {
  const env = getEnv();
  const absoluteDir = path.resolve(process.cwd(), env.LOCAL_CHARACTER_ASSET_DIR);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), bytes);
  return fileName;
}

async function removeLocalAsset(fileName: string): Promise<void> {
  const env = getEnv();
  const absolutePath = path.resolve(
    process.cwd(),
    env.LOCAL_CHARACTER_ASSET_DIR,
    path.basename(fileName),
  );
  try {
    await unlink(absolutePath);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== "ENOENT") throw err;
  }
}

function localAssetUrl(fileName: string): string {
  const env = getEnv();
  return `${env.LOCAL_CHARACTER_ASSET_BASE_PATH}/${fileName}`;
}

async function toRecordLocal(
  stored: StoredCharacterProfile,
  userId?: string,
): Promise<CharacterProfile> {
  const referenceImages = await resolveReferenceImages(stored.referenceImageIds, userId);
  return characterProfileSchema.parse({
    id: stored.id,
    name: stored.name,
    artDirection: stored.artDirection,
    referenceImages,
    voiceSample:
      stored.voiceSamplePath && stored.voiceSampleMime
        ? {
            url: localAssetUrl(stored.voiceSamplePath),
            mimeType: stored.voiceSampleMime,
            originalName: stored.voiceSampleName ?? "voice-sample",
          }
        : null,
    sheetUrl: stored.sheetStoragePath ? localAssetUrl(stored.sheetStoragePath) : null,
    muapiCharacterRequestId: stored.muapiCharacterRequestId ?? null,
    muapiCharacterSheetUrl: stored.muapiCharacterSheetStoragePath
      ? localAssetUrl(stored.muapiCharacterSheetStoragePath)
      : null,
    muapiCharacterSheetUpdatedAt: stored.muapiCharacterSheetUpdatedAt ?? null,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}

// --- Supabase backend ----------------------------------------------------------

type CharacterProfileRow = {
  id: string;
  name: string;
  art_direction: string;
  reference_image_ids: unknown;
  voice_sample_path: string | null;
  voice_sample_mime: string | null;
  voice_sample_name: string | null;
  sheet_storage_path: string | null;
  sheet_mime_type: string | null;
  muapi_character_request_id: string | null;
  muapi_character_sheet_storage_path: string | null;
  muapi_character_sheet_mime_type: string | null;
  muapi_character_sheet_updated_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

async function toRecordSupabase(
  row: CharacterProfileRow,
  userId: string,
  refById?: Map<string, ReferenceImageRecord>,
): Promise<CharacterProfile> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const expires = env.SUPABASE_SIGNED_URL_EXPIRES_SEC;

  const referenceImages = await resolveReferenceImages(
    normalizeIds(row.reference_image_ids),
    userId,
    refById,
  );

  let voiceSample: CharacterProfile["voiceSample"] = null;
  if (row.voice_sample_path && row.voice_sample_mime) {
    const url = await createStorageSignedUrl(admin, bucket, row.voice_sample_path, expires);
    voiceSample = {
      url,
      mimeType: row.voice_sample_mime,
      originalName: row.voice_sample_name ?? "voice-sample",
    };
  }

  let sheetUrl: string | null = null;
  if (row.sheet_storage_path) {
    sheetUrl = await createStorageSignedUrl(admin, bucket, row.sheet_storage_path, expires);
  }

  let muapiCharacterSheetUrl: string | null = null;
  if (row.muapi_character_sheet_storage_path) {
    muapiCharacterSheetUrl = await createStorageSignedUrl(
      admin,
      bucket,
      row.muapi_character_sheet_storage_path,
      expires,
    );
  }

  return characterProfileSchema.parse({
    id: row.id,
    name: row.name,
    artDirection: row.art_direction ?? "",
    referenceImages,
    voiceSample,
    sheetUrl,
    muapiCharacterRequestId: row.muapi_character_request_id ?? null,
    muapiCharacterSheetUrl,
    muapiCharacterSheetUpdatedAt: row.muapi_character_sheet_updated_at
      ? asIso(row.muapi_character_sheet_updated_at)
      : null,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  });
}

async function createCharacterProfileSupabase(
  input: CreateCharacterProfileInput,
  userId: string,
): Promise<CharacterProfile> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const id = randomUUID();
  const now = new Date().toISOString();

  let voiceSamplePath: string | null = null;
  if (input.voiceSample) {
    const ext = audioExtFromMime(input.voiceSample.mimeType);
    const safeBase = sanitizeFileBase(input.voiceSample.originalName);
    voiceSamplePath = `${id}/voice-${safeBase}.${ext}`;
    await uploadStorageObject(
      admin,
      bucket,
      voiceSamplePath,
      input.voiceSample.bytes,
      input.voiceSample.mimeType,
    );
  }

  const { error } = await admin.from("character_profiles").insert({
    id,
    name: input.name,
    art_direction: input.artDirection,
    reference_image_ids: input.referenceImageIds,
    voice_sample_path: voiceSamplePath,
    voice_sample_mime: input.voiceSample?.mimeType ?? null,
    voice_sample_name: input.voiceSample?.originalName ?? null,
    sheet_storage_path: null,
    sheet_mime_type: null,
    created_at: now,
    updated_at: now,
    user_id: userId,
  });
  if (error) {
    throw new Error(`character_profiles insert failed: ${error.message}`);
  }

  const refById = await buildReferenceImageMap(input.referenceImageIds, userId);

  return toRecordSupabase(
    {
      id,
      name: input.name,
      art_direction: input.artDirection,
      reference_image_ids: input.referenceImageIds,
      voice_sample_path: voiceSamplePath,
      voice_sample_mime: input.voiceSample?.mimeType ?? null,
      voice_sample_name: input.voiceSample?.originalName ?? null,
      sheet_storage_path: null,
      sheet_mime_type: null,
      muapi_character_request_id: null,
      muapi_character_sheet_storage_path: null,
      muapi_character_sheet_mime_type: null,
      muapi_character_sheet_updated_at: null,
      created_at: now,
      updated_at: now,
    },
    userId,
    refById,
  );
}

async function listCharacterProfilesSupabase(
  userId: string,
): Promise<CharacterProfile[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("character_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`character_profiles list failed: ${error.message}`);
  }
  if (!data?.length) return [];

  const rows = data as CharacterProfileRow[];
  const allRefIds = [
    ...new Set(rows.flatMap((row) => normalizeIds(row.reference_image_ids))),
  ];
  const refById = await buildReferenceImageMap(allRefIds, userId);

  return Promise.all(rows.map((row) => toRecordSupabase(row, userId, refById)));
}

export type CharacterProfileSheetContext = {
  name: string;
  artDirection: string;
  storedReferenceImageIds: string[];
};

export async function getCharacterProfileSheetContext(
  id: string,
  userId: string,
): Promise<CharacterProfileSheetContext> {
  if (isSupabasePersistenceEnabled()) {
    const row = await getCharacterProfileRowSupabase(id, userId);
    return {
      name: row.name,
      artDirection: row.art_direction ?? "",
      storedReferenceImageIds: normalizeIds(row.reference_image_ids),
    };
  }

  const profile = await getCharacterProfile(id, userId);
  return {
    name: profile.name,
    artDirection: profile.artDirection,
    storedReferenceImageIds: profile.referenceImages.map((item) => item.id),
  };
}

async function getCharacterProfileRowSupabase(
  id: string,
  userId: string,
): Promise<CharacterProfileRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("character_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`character_profiles read failed: ${error.message}`);
  }
  if (!data) {
    throw new CharacterProfileNotFoundError(id);
  }
  return data as CharacterProfileRow;
}

async function deleteCharacterProfileSupabase(id: string, userId: string): Promise<void> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const row = await getCharacterProfileRowSupabase(id, userId);

  for (const objectPath of [
    row.voice_sample_path,
    row.sheet_storage_path,
    row.muapi_character_sheet_storage_path,
  ]) {
    if (!objectPath) continue;
    try {
      await removeStorageObject(admin, bucket, objectPath);
    } catch {
      /* tolerate missing blob */
    }
  }

  const { error } = await admin
    .from("character_profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`character_profiles delete failed: ${error.message}`);
  }
}

async function updateCharacterProfileSupabase(
  id: string,
  input: UpdateCharacterProfileInput,
  userId: string,
): Promise<CharacterProfile> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const row = await getCharacterProfileRowSupabase(id, userId);

  const voiceAfter = await applyVoiceSampleMutation(
    id,
    {
      path: row.voice_sample_path,
      mime: row.voice_sample_mime,
      name: row.voice_sample_name,
    },
    input,
    {
      uploadReplacement: async ({ id: pid, voice }) => {
        const ext = audioExtFromMime(voice.mimeType);
        const safeBase = sanitizeFileBase(voice.originalName);
        const objectPath = `${pid}/voice-${safeBase}.${ext}`;
        await uploadStorageObject(admin, bucket, objectPath, voice.bytes, voice.mimeType);
        return objectPath;
      },
      removeVoiceAtPath: async (objectPath) => {
        await removeStorageObject(admin, bucket, objectPath);
      },
    },
  );

  const voiceSamplePath = voiceAfter.path;
  const voiceSampleMime = voiceAfter.mime;
  const voiceSampleName = voiceAfter.name;

  const refsChanged = referenceIdsChanged(
    normalizeIds(row.reference_image_ids),
    input.referenceImageIds,
  );

  let muapiCharacterRequestId = row.muapi_character_request_id;
  let muapiCharacterSheetStoragePath = row.muapi_character_sheet_storage_path;
  let muapiCharacterSheetMimeType = row.muapi_character_sheet_mime_type;
  let muapiCharacterSheetUpdatedAt = row.muapi_character_sheet_updated_at;

  if (refsChanged && muapiCharacterSheetStoragePath) {
    try {
      await removeStorageObject(admin, bucket, muapiCharacterSheetStoragePath);
    } catch {
      /* tolerate missing blob */
    }
    muapiCharacterRequestId = null;
    muapiCharacterSheetStoragePath = null;
    muapiCharacterSheetMimeType = null;
    muapiCharacterSheetUpdatedAt = null;
  }

  const updatedAt = new Date().toISOString();
  const { error } = await admin
    .from("character_profiles")
    .update({
      name: input.name,
      art_direction: input.artDirection,
      reference_image_ids: input.referenceImageIds,
      voice_sample_path: voiceSamplePath,
      voice_sample_mime: voiceSampleMime,
      voice_sample_name: voiceSampleName,
      muapi_character_request_id: muapiCharacterRequestId,
      muapi_character_sheet_storage_path: muapiCharacterSheetStoragePath,
      muapi_character_sheet_mime_type: muapiCharacterSheetMimeType,
      muapi_character_sheet_updated_at: muapiCharacterSheetUpdatedAt,
      updated_at: updatedAt,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`character_profiles update failed: ${error.message}`);
  }

  const refById = await buildReferenceImageMap(input.referenceImageIds, userId);

  return toRecordSupabase(
    {
      ...row,
      name: input.name,
      art_direction: input.artDirection,
      reference_image_ids: input.referenceImageIds,
      voice_sample_path: voiceSamplePath,
      voice_sample_mime: voiceSampleMime,
      voice_sample_name: voiceSampleName,
      muapi_character_request_id: muapiCharacterRequestId,
      muapi_character_sheet_storage_path: muapiCharacterSheetStoragePath,
      muapi_character_sheet_mime_type: muapiCharacterSheetMimeType,
      muapi_character_sheet_updated_at: muapiCharacterSheetUpdatedAt,
      updated_at: updatedAt,
    },
    userId,
    refById,
  );
}

type ProfileSheetAssetKind =
  | { kind: "frameSequence" }
  | { kind: "characterReference"; requestId: string | null };

type SheetAssetBytesInput = {
  bytes: Uint8Array;
  mimeType: string;
};

function sheetStorageObjectPath(profileId: string, assetKind: ProfileSheetAssetKind, ext: string) {
  return assetKind.kind === "frameSequence"
    ? `${profileId}/sheet.${ext}`
    : `${profileId}/muapi-character-sheet.${ext}`;
}

function sheetLocalAssetFileName(profileId: string, assetKind: ProfileSheetAssetKind, ext: string) {
  return assetKind.kind === "frameSequence"
    ? `sheet-${profileId}.${ext}`
    : `muapi-char-sheet-${profileId}.${ext}`;
}

async function persistProfileSheetAssetSupabase(
  id: string,
  input: SheetAssetBytesInput,
  assetKind: ProfileSheetAssetKind,
  userId: string,
): Promise<CharacterProfile> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const row = await getCharacterProfileRowSupabase(id, userId);

  const ext = imageExtFromMime(input.mimeType);
  const objectPath = sheetStorageObjectPath(id, assetKind, ext);
  await uploadStorageObject(admin, bucket, objectPath, input.bytes, input.mimeType);

  const previousPath =
    assetKind.kind === "frameSequence"
      ? row.sheet_storage_path
      : row.muapi_character_sheet_storage_path;
  if (previousPath && previousPath !== objectPath) {
    try {
      await removeStorageObject(admin, bucket, previousPath);
    } catch {
      /* tolerate missing blob */
    }
  }

  const updatedAt = new Date().toISOString();
  const updatePayload =
    assetKind.kind === "frameSequence"
      ? {
          sheet_storage_path: objectPath,
          sheet_mime_type: input.mimeType,
          updated_at: updatedAt,
        }
      : {
          muapi_character_request_id: assetKind.requestId,
          muapi_character_sheet_storage_path: objectPath,
          muapi_character_sheet_mime_type: input.mimeType,
          muapi_character_sheet_updated_at: updatedAt,
          updated_at: updatedAt,
        };

  const { error } = await admin
    .from("character_profiles")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`character_profiles update failed: ${error.message}`);
  }

  const refIds = normalizeIds(row.reference_image_ids);
  const refById = await buildReferenceImageMap(refIds, userId);

  const updatedRow =
    assetKind.kind === "frameSequence"
      ? {
          ...row,
          sheet_storage_path: objectPath,
          sheet_mime_type: input.mimeType,
          updated_at: updatedAt,
        }
      : {
          ...row,
          muapi_character_request_id: assetKind.requestId,
          muapi_character_sheet_storage_path: objectPath,
          muapi_character_sheet_mime_type: input.mimeType,
          muapi_character_sheet_updated_at: updatedAt,
          updated_at: updatedAt,
        };

  return toRecordSupabase(updatedRow, userId, refById);
}

async function persistProfileSheetAssetLocal(
  id: string,
  input: SheetAssetBytesInput,
  assetKind: ProfileSheetAssetKind,
  userId?: string,
): Promise<CharacterProfile> {
  const records = await readLocalIndex();
  const stored = records.find((item) => item.id === id);
  if (!stored) {
    throw new CharacterProfileNotFoundError(id);
  }

  const ext = imageExtFromMime(input.mimeType);
  const fileName = await writeLocalAsset(sheetLocalAssetFileName(id, assetKind, ext), input.bytes);

  if (assetKind.kind === "frameSequence") {
    if (stored.sheetStoragePath && stored.sheetStoragePath !== fileName) {
      await removeLocalAsset(stored.sheetStoragePath);
    }
    stored.sheetStoragePath = fileName;
    stored.sheetMimeType = input.mimeType;
    stored.updatedAt = new Date().toISOString();
  } else {
    if (
      stored.muapiCharacterSheetStoragePath &&
      stored.muapiCharacterSheetStoragePath !== fileName
    ) {
      await removeLocalAsset(stored.muapiCharacterSheetStoragePath);
    }
    stored.muapiCharacterRequestId = assetKind.requestId;
    stored.muapiCharacterSheetStoragePath = fileName;
    stored.muapiCharacterSheetMimeType = input.mimeType;
    stored.muapiCharacterSheetUpdatedAt = new Date().toISOString();
    stored.updatedAt = stored.muapiCharacterSheetUpdatedAt;
  }

  await writeIndex(records);
  return toRecordLocal(stored, userId);
}

// --- Public API ----------------------------------------------------------------

export async function createCharacterProfile(
  input: CreateCharacterProfileInput,
  userId?: string,
): Promise<CharacterProfile> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return createCharacterProfileSupabase(input, userId);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  let voiceSamplePath: string | null = null;
  if (input.voiceSample) {
    const ext = audioExtFromMime(input.voiceSample.mimeType);
    const safeBase = sanitizeFileBase(input.voiceSample.originalName);
    voiceSamplePath = await writeLocalAsset(
      `voice-${safeBase}-${id}.${ext}`,
      input.voiceSample.bytes,
    );
  }

  const stored: StoredCharacterProfile = {
    id,
    name: input.name,
    artDirection: input.artDirection,
    referenceImageIds: input.referenceImageIds,
    voiceSamplePath,
    voiceSampleMime: input.voiceSample?.mimeType ?? null,
    voiceSampleName: input.voiceSample?.originalName ?? null,
    sheetStoragePath: null,
    sheetMimeType: null,
    createdAt: now,
    updatedAt: now,
  };
  const current = await readLocalIndex();
  current.unshift(stored);
  await writeIndex(current);
  return toRecordLocal(stored, userId);
}

export async function listCharacterProfiles(
  userId?: string,
): Promise<CharacterProfile[]> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return listCharacterProfilesSupabase(userId);
  }

  const records = await readLocalIndex();
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: CharacterProfile[] = [];
  for (const stored of records) {
    out.push(await toRecordLocal(stored, userId));
  }
  return out;
}

export async function getCharacterProfile(
  id: string,
  userId?: string,
): Promise<CharacterProfile> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    const row = await getCharacterProfileRowSupabase(id, userId);
    const refIds = normalizeIds(row.reference_image_ids);
    const refById = await buildReferenceImageMap(refIds, userId);
    return toRecordSupabase(row, userId, refById);
  }

  const records = await readLocalIndex();
  const stored = records.find((item) => item.id === id);
  if (!stored) {
    throw new CharacterProfileNotFoundError(id);
  }
  return toRecordLocal(stored, userId);
}

export async function updateCharacterProfile(
  id: string,
  input: UpdateCharacterProfileInput,
  userId?: string,
): Promise<CharacterProfile> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return updateCharacterProfileSupabase(id, input, userId);
  }

  const records = await readLocalIndex();
  const stored = records.find((item) => item.id === id);
  if (!stored) {
    throw new CharacterProfileNotFoundError(id);
  }

  const voiceAfter = await applyVoiceSampleMutation(
    id,
    {
      path: stored.voiceSamplePath,
      mime: stored.voiceSampleMime,
      name: stored.voiceSampleName,
    },
    input,
    {
      uploadReplacement: async ({ id: pid, voice }) => {
        const ext = audioExtFromMime(voice.mimeType);
        const safeBase = sanitizeFileBase(voice.originalName);
        return writeLocalAsset(
          `voice-${safeBase}-${pid}.${ext}`,
          voice.bytes,
        );
      },
      removeVoiceAtPath: removeLocalAsset,
    },
  );

  stored.voiceSamplePath = voiceAfter.path;
  stored.voiceSampleMime = voiceAfter.mime;
  stored.voiceSampleName = voiceAfter.name;

  if (referenceIdsChanged(stored.referenceImageIds, input.referenceImageIds)) {
    await clearMuapiCharacterSheetLocal(stored);
  }

  stored.name = input.name;
  stored.artDirection = input.artDirection;
  stored.referenceImageIds = input.referenceImageIds;
  stored.updatedAt = new Date().toISOString();
  await writeIndex(records);
  return toRecordLocal(stored, userId);
}

export async function deleteCharacterProfile(id: string, userId?: string): Promise<void> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return deleteCharacterProfileSupabase(id, userId);
  }

  const records = await readLocalIndex();
  const stored = records.find((item) => item.id === id);
  if (!stored) {
    throw new CharacterProfileNotFoundError(id);
  }
  for (const fileName of [
    stored.voiceSamplePath,
    stored.sheetStoragePath,
    stored.muapiCharacterSheetStoragePath,
  ]) {
    if (fileName) await removeLocalAsset(fileName);
  }
  await writeIndex(records.filter((item) => item.id !== id));
}

export async function saveProfileSheetImage(
  id: string,
  input: SaveProfileSheetImageInput,
  userId?: string,
): Promise<CharacterProfile> {
  const assetKind: ProfileSheetAssetKind = { kind: "frameSequence" };
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return persistProfileSheetAssetSupabase(id, input, assetKind, userId);
  }
  return persistProfileSheetAssetLocal(id, input, assetKind, userId);
}

export async function saveCharacterProfileSheet(
  id: string,
  input: SaveCharacterProfileSheetInput,
  userId?: string,
): Promise<CharacterProfile> {
  const assetKind: ProfileSheetAssetKind = {
    kind: "characterReference",
    requestId: input.requestId,
  };
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return persistProfileSheetAssetSupabase(id, input, assetKind, userId);
  }
  return persistProfileSheetAssetLocal(id, input, assetKind, userId);
}

/** @deprecated Use saveCharacterProfileSheet */
export const saveMuapiCharacterSheet = saveCharacterProfileSheet;
