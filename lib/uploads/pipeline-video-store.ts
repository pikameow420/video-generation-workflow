import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { getEnv } from "@/lib/env";

export type PipelineVideoRecord = {
  /** Stable key (Atlas/MuAPI prediction id). */
  id: string;
  url: string;
  bytes: number;
  createdAt: string;
  updatedAt: string;
  hasCaptions: boolean;
};

function sanitizePredictionId(predictionId: string): string {
  const clean = predictionId.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
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

export async function putPipelineVideo(input: {
  bytes: Uint8Array;
  predictionId: string;
  hasCaptions: boolean;
}): Promise<PipelineVideoRecord> {
  const id = input.predictionId.trim();
  if (!id) {
    throw new Error("predictionId is required to store pipeline video");
  }

  const indexPath = path.resolve(
    process.cwd(),
    getEnv().CAPTIONED_VIDEO_INDEX_PATH,
  );
  const existing = (await readIndex(indexPath)).find((r) => r.id === id);
  const now = new Date().toISOString();
  const url = await writeVideoBytes(id, input.bytes);

  const record: PipelineVideoRecord = {
    id,
    url,
    bytes: input.bytes.byteLength,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    hasCaptions: input.hasCaptions,
  };
  await upsertIndex(record);
  return record;
}

export async function getPipelineVideoRecord(
  predictionId: string,
): Promise<PipelineVideoRecord | null> {
  const id = predictionId.trim();
  if (!id) return null;
  const indexPath = path.resolve(
    process.cwd(),
    getEnv().CAPTIONED_VIDEO_INDEX_PATH,
  );
  const record = (await readIndex(indexPath)).find((r) => r.id === id);
  return record ?? null;
}

export async function ingestRemotePipelineVideo(input: {
  sourceUrl: string;
  predictionId: string;
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
  });
}
