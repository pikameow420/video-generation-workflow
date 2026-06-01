import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createStorageSignedUrl,
  uploadStorageObject,
} from "@/lib/supabase/storage";

const MAX_TITLE_LEN = 200;

export type PipelineVideoRecord = {
  /** Stable key (Atlas/MuAPI prediction id). */
  id: string;
  url: string;
  bytes: number;
  createdAt: string;
  updatedAt: string;
  hasCaptions: boolean;
  /** Human-readable label; null when unset or legacy rows. */
  title: string | null;
  /** Local JSON index only - soft-remove from library without DB. */
  isDeleted?: boolean;
};

function sanitizePredictionId(predictionId: string): string {
  const clean = predictionId
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "video";
}

function fileNameForPrediction(predictionId: string): string {
  return `${sanitizePredictionId(predictionId)}.mp4`;
}

function blobPathname(predictionId: string): string {
  return `captioned-videos/${fileNameForPrediction(predictionId)}`;
}

async function readIndex(indexPath: string): Promise<PipelineVideoRecord[]> {
  try {
    const content = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(content) as PipelineVideoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") return [];
    throw err;
  }
}

async function upsertIndex(record: PipelineVideoRecord): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.CAPTIONED_VIDEO_INDEX_PATH);
  await mkdir(path.dirname(indexPath), { recursive: true });
  const current = await readIndex(indexPath);
  const next = [record, ...current.filter((r) => r.id !== record.id)];
  await writeFile(indexPath, JSON.stringify(next, null, 2), "utf8");
}

async function writeVideoBytes(
  predictionId: string,
  bytes: Uint8Array,
): Promise<string> {
  const env = getEnv();
  const fileName = fileNameForPrediction(predictionId);

  if (env.UPLOAD_BACKEND === "blob") {
    const token = env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required when UPLOAD_BACKEND=blob",
      );
    }
    const uploaded = await put(blobPathname(predictionId), Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "video/mp4",
      token,
    });
    return uploaded.url;
  }

  const absoluteDir = path.resolve(process.cwd(), env.LOCAL_CAPTIONED_VIDEO_DIR);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), bytes);
  return `${env.LOCAL_CAPTIONED_VIDEO_BASE_PATH}/${fileName}`;
}

function asIso(ts: unknown): string {
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return new Date(ts as never).toISOString();
}

function normalizeTitleInput(
  title: string | undefined,
): string | null | undefined {
  if (title === undefined) return undefined;
  const t = title.trim().slice(0, MAX_TITLE_LEN);
  return t || null;
}

async function putPipelineVideoSupabase(input: {
  bytes: Uint8Array;
  predictionId: string;
  hasCaptions: boolean;
  userId: string;
  /** Set or clear display title; omit to keep existing row title. */
  title?: string | undefined;
}): Promise<PipelineVideoRecord> {
  const env = getEnv();
  const id = input.predictionId.trim();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_PIPELINE_VIDEOS_BUCKET;
  const objectPath = fileNameForPrediction(id);
  await uploadStorageObject(admin, bucket, objectPath, input.bytes, "video/mp4");

  const now = new Date().toISOString();
  const { data: prevRow } = await admin
    .from("pipeline_videos")
    .select("created_at, title")
    .eq("id", id)
    .maybeSingle();

  const createdAt = prevRow?.created_at
    ? asIso(prevRow.created_at)
    : now;

  const prevTitle =
    prevRow && typeof prevRow === "object" && "title" in prevRow
      ? (prevRow as { title?: unknown }).title
      : null;
  const resolvedTitle =
    input.title !== undefined
      ? normalizeTitleInput(input.title) ?? null
      : typeof prevTitle === "string"
        ? prevTitle.slice(0, MAX_TITLE_LEN) || null
        : null;

  const { error } = await admin.from("pipeline_videos").upsert(
    {
      id,
      storage_path: objectPath,
      bytes: input.bytes.byteLength,
      has_captions: input.hasCaptions,
      title: resolvedTitle,
      created_at: createdAt,
      updated_at: now,
      is_deleted: false,
      user_id: input.userId,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(`pipeline_videos upsert failed: ${error.message}`);
  }

  const url = await createStorageSignedUrl(
    admin,
    bucket,
    objectPath,
    env.SUPABASE_SIGNED_URL_EXPIRES_SEC,
  );
  return {
    id,
    url,
    bytes: input.bytes.byteLength,
    createdAt,
    updatedAt: now,
    hasCaptions: input.hasCaptions,
    title: resolvedTitle,
  };
}

async function getPipelineVideoRecordSupabase(
  predictionId: string,
  userId: string,
): Promise<PipelineVideoRecord | null> {
  const env = getEnv();
  const id = predictionId.trim();
  if (!id) return null;
  const admin = createAdminClient();
  const bucket = env.SUPABASE_PIPELINE_VIDEOS_BUCKET;
  const { data, error } = await admin
    .from("pipeline_videos")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) {
    throw new Error(`pipeline_videos read failed: ${error.message}`);
  }
  if (!data) return null;

  const objectPath =
    typeof data.storage_path === "string" ? data.storage_path : "";
  const url = await createStorageSignedUrl(
    admin,
    bucket,
    objectPath,
    env.SUPABASE_SIGNED_URL_EXPIRES_SEC,
  );
  const rawTitle = (data as { title?: unknown }).title;
  const title =
    typeof rawTitle === "string" ? rawTitle.slice(0, MAX_TITLE_LEN) : null;
  return {
    id: data.id as string,
    url,
    bytes: Number(data.bytes),
    createdAt: asIso(data.created_at),
    updatedAt: asIso(data.updated_at),
    hasCaptions: Boolean(data.has_captions),
    title,
  };
}

export async function putPipelineVideo(input: {
  bytes: Uint8Array;
  predictionId: string;
  hasCaptions: boolean;
  userId?: string;
  title?: string | undefined;
}): Promise<PipelineVideoRecord> {
  const id = input.predictionId.trim();
  if (!id) {
    throw new Error("predictionId is required to store pipeline video");
  }

  if (isSupabasePersistenceEnabled()) {
    if (!input.userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return putPipelineVideoSupabase({ ...input, userId: input.userId });
  }

  const indexPath = path.resolve(
    process.cwd(),
    getEnv().CAPTIONED_VIDEO_INDEX_PATH,
  );
  const existing = (await readIndex(indexPath)).find((r) => r.id === id);
  const now = new Date().toISOString();
  const url = await writeVideoBytes(id, input.bytes);

  const resolvedTitle =
    input.title !== undefined
      ? normalizeTitleInput(input.title) ?? null
      : (existing?.title ?? null);

  const record: PipelineVideoRecord = {
    id,
    url,
    bytes: input.bytes.byteLength,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    hasCaptions: input.hasCaptions,
    title: resolvedTitle,
    isDeleted: false,
  };
  await upsertIndex(record);
  return record;
}

export async function getPipelineVideoRecord(
  predictionId: string,
  userId?: string,
): Promise<PipelineVideoRecord | null> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return getPipelineVideoRecordSupabase(predictionId, userId);
  }

  const id = predictionId.trim();
  if (!id) return null;
  const indexPath = path.resolve(
    process.cwd(),
    getEnv().CAPTIONED_VIDEO_INDEX_PATH,
  );
  const record = (await readIndex(indexPath)).find((r) => r.id === id);
  if (!record || record.isDeleted) return null;
  if (record.title === undefined) {
    return { ...record, title: null };
  }
  return record;
}

export type PipelineVideoListRow = {
  id: string;
  url: string;
  bytes: number;
  hasCaptions: boolean;
  createdAt: string;
  updatedAt: string;
  title: string | null;
};

/** Lists stored pipeline videos from Supabase (newest first). Returns empty when persistence is off. */
export async function listPipelineVideosPage(input: {
  limit: number;
  offset: number;
  userId?: string;
}): Promise<{ items: PipelineVideoListRow[]; total: number }> {
  if (!isSupabasePersistenceEnabled()) {
    return { items: [], total: 0 };
  }

  if (!input.userId) {
    throw new Error("userId required when Supabase persistence is enabled");
  }

  const env = getEnv();
  const admin = createAdminClient();
  const bucket = env.SUPABASE_PIPELINE_VIDEOS_BUCKET;

  const { count, error: countError } = await admin
    .from("pipeline_videos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("is_deleted", false);

  if (countError) {
    throw new Error(`pipeline_videos count failed: ${countError.message}`);
  }

  const total = typeof count === "number" ? count : 0;
  const { data, error } = await admin
    .from("pipeline_videos")
    .select(
      "id, storage_path, bytes, has_captions, created_at, updated_at, title",
    )
    .eq("user_id", input.userId)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (error) {
    throw new Error(`pipeline_videos list failed: ${error.message}`);
  }

  const rows = data ?? [];
  const items: PipelineVideoListRow[] = await Promise.all(
    rows.map(async (row) => {
      const objectPath =
        typeof row.storage_path === "string" ? row.storage_path : "";
      const url = await createStorageSignedUrl(
        admin,
        bucket,
        objectPath,
        env.SUPABASE_SIGNED_URL_EXPIRES_SEC,
      );
      const rawTitle = (row as { title?: unknown }).title;
      const title =
        typeof rawTitle === "string" ? rawTitle.slice(0, MAX_TITLE_LEN) : null;
      return {
        id: String(row.id),
        url,
        bytes: Number(row.bytes),
        hasCaptions: Boolean(row.has_captions),
        createdAt: asIso(row.created_at),
        updatedAt: asIso(row.updated_at),
        title,
      };
    }),
  );

  return { items, total };
}

export async function ingestRemotePipelineVideo(input: {
  sourceUrl: string;
  predictionId: string;
  userId?: string;
  title?: string;
}): Promise<PipelineVideoRecord> {
  const res = await fetch(input.sourceUrl);
  if (!res.ok) {
    throw new Error(`Could not download generated video (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return putPipelineVideo({
    bytes,
    predictionId: input.predictionId,
    hasCaptions: false,
    title: input.title,
    userId: input.userId,
  });
}

/** Soft-delete: keep row and storage object; hide from library / status shortcuts. */
export async function softDeletePipelineVideo(predictionId: string, userId?: string): Promise<void> {
  const id = predictionId.trim();
  if (!id) throw new Error("predictionId is required");

  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("pipeline_videos")
      .update({ is_deleted: true, updated_at: now })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .select("id");
    if (error) {
      throw new Error(`pipeline_videos soft-delete failed: ${error.message}`);
    }
    if (!data?.length) {
      const { data: row } = await admin
        .from("pipeline_videos")
        .select("id, is_deleted")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (row && (row as { is_deleted?: boolean }).is_deleted === true) {
        return;
      }
      throw new Error("Video not found");
    }
    return;
  }

  const indexPath = path.resolve(
    process.cwd(),
    getEnv().CAPTIONED_VIDEO_INDEX_PATH,
  );
  const current = await readIndex(indexPath);
  const record = current.find((r) => r.id === id);
  if (!record) {
    throw new Error("Video not found");
  }
  if (record.isDeleted) return;
  const next = current.map((r) =>
    r.id === id ? { ...r, isDeleted: true } : r,
  );
  await writeFile(indexPath, JSON.stringify(next, null, 2), "utf8");
}
