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
import { listReferenceImages } from "@/lib/uploads/store";
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

export type SaveCharacterProfileSheetInput = {
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
  createdAt: string;
  updatedAt: string;
};

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

function normalizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

/** Anchor refs are stored by id; URLs are re-resolved at read time because signed URLs expire. */
async function resolveReferenceImages(
  ids: string[],
  userId?: string,
): Promise<CharacterProfileReference[]> {
  if (!ids.length) return [];
  const library = await listReferenceImages(userId);
  const byId = new Map(library.map((item) => [item.id, item]));
  const out: CharacterProfileReference[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    out.push({ id: item.id, url: item.url, originalName: item.originalName });
  }
  return out;
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
  created_at: unknown;
  updated_at: unknown;
};

async function toRecordSupabase(
  row: CharacterProfileRow,
  userId: string,
): Promise<CharacterProfile> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const expires = env.SUPABASE_SIGNED_URL_EXPIRES_SEC;

  const referenceImages = await resolveReferenceImages(
    normalizeIds(row.reference_image_ids),
    userId,
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

  return characterProfileSchema.parse({
    id: row.id,
    name: row.name,
    artDirection: row.art_direction ?? "",
    referenceImages,
    voiceSample,
    sheetUrl,
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
      created_at: now,
      updated_at: now,
    },
    userId,
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

  return Promise.all(
    data.map((row) => toRecordSupabase(row as CharacterProfileRow, userId)),
  );
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

  for (const objectPath of [row.voice_sample_path, row.sheet_storage_path]) {
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
      updated_at: updatedAt,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`character_profiles update failed: ${error.message}`);
  }

  return toRecordSupabase(
    {
      ...row,
      name: input.name,
      art_direction: input.artDirection,
      reference_image_ids: input.referenceImageIds,
      voice_sample_path: voiceSamplePath,
      voice_sample_mime: voiceSampleMime,
      voice_sample_name: voiceSampleName,
      updated_at: updatedAt,
    },
    userId,
  );
}

async function saveCharacterProfileSheetSupabase(
  id: string,
  input: SaveCharacterProfileSheetInput,
  userId: string,
): Promise<CharacterProfile> {
  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_CHARACTER_ASSETS_BUCKET;
  const row = await getCharacterProfileRowSupabase(id, userId);

  const ext = imageExtFromMime(input.mimeType);
  const objectPath = `${id}/sheet.${ext}`;
  await uploadStorageObject(admin, bucket, objectPath, input.bytes, input.mimeType);

  if (row.sheet_storage_path && row.sheet_storage_path !== objectPath) {
    try {
      await removeStorageObject(admin, bucket, row.sheet_storage_path);
    } catch {
      /* tolerate missing blob */
    }
  }

  const updatedAt = new Date().toISOString();
  const { error } = await admin
    .from("character_profiles")
    .update({
      sheet_storage_path: objectPath,
      sheet_mime_type: input.mimeType,
      updated_at: updatedAt,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`character_profiles update failed: ${error.message}`);
  }

  return toRecordSupabase(
    {
      ...row,
      sheet_storage_path: objectPath,
      sheet_mime_type: input.mimeType,
      updated_at: updatedAt,
    },
    userId,
  );
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
    return toRecordSupabase(row, userId);
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
  for (const fileName of [stored.voiceSamplePath, stored.sheetStoragePath]) {
    if (fileName) await removeLocalAsset(fileName);
  }
  await writeIndex(records.filter((item) => item.id !== id));
}

export async function saveCharacterProfileSheet(
  id: string,
  input: SaveCharacterProfileSheetInput,
  userId?: string,
): Promise<CharacterProfile> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return saveCharacterProfileSheetSupabase(id, input, userId);
  }

  const records = await readLocalIndex();
  const stored = records.find((item) => item.id === id);
  if (!stored) {
    throw new CharacterProfileNotFoundError(id);
  }

  const ext = imageExtFromMime(input.mimeType);
  const fileName = await writeLocalAsset(`sheet-${id}.${ext}`, input.bytes);
  if (stored.sheetStoragePath && stored.sheetStoragePath !== fileName) {
    await removeLocalAsset(stored.sheetStoragePath);
  }
  stored.sheetStoragePath = fileName;
  stored.sheetMimeType = input.mimeType;
  stored.updatedAt = new Date().toISOString();
  await writeIndex(records);
  return toRecordLocal(stored, userId);
}
