import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BlobNotFoundError, del, put } from "@vercel/blob";
import { getEnv } from "@/lib/env";

export type ReferenceImageRecord = {
  id: string;
  url: string;
  mimeType: string;
  bytes: number;
  originalName: string;
  createdAt: string;
};

type PutReferenceImageInput = {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extFromMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? "bin";
}

function sanitizeFileBase(input: string): string {
  const base = path.basename(input, path.extname(input));
  const clean = base.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "reference";
}

async function readIndex(indexPath: string): Promise<ReferenceImageRecord[]> {
  try {
    const content = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(content) as ReferenceImageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function appendToIndex(record: ReferenceImageRecord): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.REFERENCE_IMAGE_INDEX_PATH);
  await mkdir(path.dirname(indexPath), { recursive: true });
  const current = await readIndex(indexPath);
  current.unshift(record);
  await writeFullIndexRecords(current);
}

async function writeFullIndexRecords(records: ReferenceImageRecord[]): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.REFERENCE_IMAGE_INDEX_PATH);
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, JSON.stringify(records, null, 2), "utf8");
}

async function putLocalReferenceImage(
  input: PutReferenceImageInput,
): Promise<ReferenceImageRecord> {
  const env = getEnv();
  const id = randomUUID();
  const ext = extFromMime(input.mimeType);
  const safeBase = sanitizeFileBase(input.originalName);
  const fileName = `${safeBase}-${id}.${ext}`;
  const absoluteDir = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), input.bytes);

  const createdAt = new Date().toISOString();
  const record: ReferenceImageRecord = {
    id,
    url: `${env.LOCAL_UPLOAD_BASE_PATH}/${fileName}`,
    mimeType: input.mimeType,
    bytes: input.bytes.byteLength,
    originalName: input.originalName,
    createdAt,
  };
  await appendToIndex(record);
  return record;
}

async function putBlobReferenceImage(
  input: PutReferenceImageInput,
): Promise<ReferenceImageRecord> {
  const env = getEnv();
  const id = randomUUID();
  const ext = extFromMime(input.mimeType);
  const safeBase = sanitizeFileBase(input.originalName);
  const fileName = `${safeBase}-${id}.${ext}`;
  const pathname = `reference-images/${fileName}`;
  const uploaded = await put(pathname, Buffer.from(input.bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: input.mimeType,
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  const createdAt = new Date().toISOString();
  const record: ReferenceImageRecord = {
    id,
    url: uploaded.url,
    mimeType: input.mimeType,
    bytes: input.bytes.byteLength,
    originalName: input.originalName,
    createdAt,
  };
  await appendToIndex(record);
  return record;
}

export async function putReferenceImage(
  input: PutReferenceImageInput,
): Promise<ReferenceImageRecord> {
  const env = getEnv();
  if (env.UPLOAD_BACKEND === "blob") {
    return putBlobReferenceImage(input);
  }
  return putLocalReferenceImage(input);
}

export async function listReferenceImages(): Promise<ReferenceImageRecord[]> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.REFERENCE_IMAGE_INDEX_PATH);
  const records = await readIndex(indexPath);
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function localFileNameFromRecordUrl(recordUrl: string): string {
  const trimmed = recordUrl.trim();
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return path.basename(new URL(trimmed).pathname);
    }
  } catch {
    /* fall through */
  }
  return path.basename(trimmed.split("?")[0] ?? trimmed);
}

export class ReferenceImageNotFoundError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Reference image not found: ${id}`);
    this.name = "ReferenceImageNotFoundError";
    this.id = id;
  }
}

export async function deleteReferenceImage(id: string): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.REFERENCE_IMAGE_INDEX_PATH);
  const current = await readIndex(indexPath);
  const record = current.find((r) => r.id === id);
  if (!record) {
    throw new ReferenceImageNotFoundError(id);
  }

  if (env.UPLOAD_BACKEND === "blob") {
    const token = env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required to delete blob reference images",
      );
    }
    try {
      await del(record.url, { token });
    } catch (err) {
      if (!(err instanceof BlobNotFoundError)) throw err;
    }
  } else {
    const fileName = localFileNameFromRecordUrl(record.url);
    const absolutePath = path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR, fileName);
    try {
      await unlink(absolutePath);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== "ENOENT") throw err;
    }
  }

  await writeFullIndexRecords(current.filter((r) => r.id !== id));
}
