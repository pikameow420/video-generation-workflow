import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { getEnv } from "@/lib/env";

export type CaptionedVideoRecord = {
  id: string;
  url: string;
  bytes: number;
  originalName: string;
  createdAt: string;
};

async function readIndex(indexPath: string): Promise<CaptionedVideoRecord[]> {
  try {
    const content = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(content) as CaptionedVideoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") return [];
    throw err;
  }
}

async function appendToIndex(record: CaptionedVideoRecord): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.CAPTIONED_VIDEO_INDEX_PATH);
  await mkdir(path.dirname(indexPath), { recursive: true });
  const current = await readIndex(indexPath);
  current.unshift(record);
  await writeFile(indexPath, JSON.stringify(current, null, 2), "utf8");
}

export async function putCaptionedVideo(input: {
  bytes: Uint8Array;
  originalName: string;
}): Promise<CaptionedVideoRecord> {
  const env = getEnv();
  const id = randomUUID();
  const fileName = `${input.originalName.replace(/[^a-zA-Z0-9-_]+/g, "-")}-${id}.mp4`;

  let url: string;
  if (env.UPLOAD_BACKEND === "blob") {
    const uploaded = await put(`captioned-videos/${fileName}`, Buffer.from(input.bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType: "video/mp4",
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    url = uploaded.url;
  } else {
    const absoluteDir = path.resolve(process.cwd(), env.LOCAL_CAPTIONED_VIDEO_DIR);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), input.bytes);
    url = `${env.LOCAL_CAPTIONED_VIDEO_BASE_PATH}/${fileName}`;
  }

  const record: CaptionedVideoRecord = {
    id,
    url,
    bytes: input.bytes.byteLength,
    originalName: input.originalName,
    createdAt: new Date().toISOString(),
  };
  await appendToIndex(record);
  return record;
}
