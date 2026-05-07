import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { videoRequestSchema } from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import {
  createAtlasAssetFromUrl,
  uploadMediaFile,
  waitForAtlasAssetReady,
  waitForVideoFromScriptAndImageUrl,
} from "@/lib/seedance/client";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseImageRef(s: string): {
  remoteUrl?: string;
  buffer?: Buffer;
  mime?: string;
  filename?: string;
} {
  const trimmed = s.trim();
  if (
    trimmed.startsWith("asset://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  ) {
    return { remoteUrl: trimmed };
  }

  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (!m) {
    throw new Error(
      "imageDataUrlOrUrl must be a data:image/...;base64,... value, app-relative path, http/https image URL, or asset:// reference",
    );
  }
  const mime = m[1];
  const b64 = m[2].replace(/\s/g, "");
  const buffer = Buffer.from(b64, "base64");
  const ext =
    mime.includes("jpeg") || mime.includes("jpg")
      ? "jpg"
      : mime.includes("webp")
        ? "webp"
        : "png";
  const filename = `sheet.${ext}`;
  return { buffer, mime, filename };
}

function extensionFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  return "bin";
}

function shouldUploadRemoteForAtlas(url: URL): boolean {
  return (
    url.protocol === "http:" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname.endsWith(".local")
  );
}

async function uploadRemoteImageToAtlas(
  sourceUrl: string,
  env: ReturnType<typeof getEnv>,
): Promise<string> {
  const apiKey = env.ATLASCLOUD_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "ATLASCLOUD_API_KEY is required to upload reference images for video generation",
    );
  }
  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) {
    throw new Error(`Failed to download reference image (${sourceRes.status})`);
  }
  const contentType = sourceRes.headers.get("content-type") ?? "image/png";
  const ext = extensionFromMime(contentType);
  const bytes = Buffer.from(await sourceRes.arrayBuffer());
  const { downloadUrl } = await uploadMediaFile({
    buffer: bytes,
    filename: `reference.${ext}`,
    contentType,
    apiKey,
    baseUrl: env.ATLASCLOUD_BASE_URL,
  });
  return downloadUrl;
}

async function resolveImageUrl(
  raw: string,
  req: Request,
): Promise<string | undefined> {
  const env = getEnv();
  const ref = parseImageRef(raw);
  if (ref.remoteUrl?.startsWith("asset://")) {
    return ref.remoteUrl;
  }
  if (ref.remoteUrl?.startsWith("/")) {
    ref.remoteUrl = new URL(ref.remoteUrl, req.url).toString();
  }

  let imageUrl = ref.remoteUrl;
  if (ref.buffer && ref.mime && ref.filename) {
    const apiKey = env.ATLASCLOUD_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error(
        "ATLASCLOUD_API_KEY is required to upload reference images for video generation",
      );
    }
    const { downloadUrl } = await uploadMediaFile({
      buffer: ref.buffer,
      filename: ref.filename,
      contentType: ref.mime,
      apiKey,
      baseUrl: env.ATLASCLOUD_BASE_URL,
    });
    imageUrl = downloadUrl;
  }
  if (imageUrl) {
    const url = new URL(imageUrl);
    if (shouldUploadRemoteForAtlas(url)) {
      imageUrl = await uploadRemoteImageToAtlas(imageUrl, env);
    }
  }
  return imageUrl;
}

function normalizeAtlasVideoError(err: unknown): string {
  const fallback = err instanceof Error ? err.message : "Failed to generate video";
  const lower = fallback.toLowerCase();
  if (
    lower.includes("input image may contain real person") ||
    lower.includes("error_code\":1010001") ||
    lower.includes("error_code:1010001")
  ) {
    return "Atlas blocked this request because a reference image may contain a real person. Use Atlas library-audited assets (asset://...) for real-person references, or switch to non-real-person references.";
  }
  return fallback;
}

function isRealPersonPolicyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("input image may contain real person") ||
    lower.includes("error_code\":1010001") ||
    lower.includes("error_code:1010001")
  );
}

function canAutoAssetize(env: ReturnType<typeof getEnv>): boolean {
  return Boolean(
    env.ATLASCLOUD_CONSOLE_ACCESS_TOKEN?.trim() &&
      env.ATLASCLOUD_CONSOLE_ACCOUNT_ID?.trim(),
  );
}

async function assetizeImageUrls(imageUrls: string[]): Promise<string[]> {
  const env = getEnv();
  const accessToken = env.ATLASCLOUD_CONSOLE_ACCESS_TOKEN?.trim();
  const accountId = env.ATLASCLOUD_CONSOLE_ACCOUNT_ID?.trim();
  if (!accessToken || !accountId) {
    throw new Error(
      "Atlas console credentials are missing. Set ATLASCLOUD_CONSOLE_ACCESS_TOKEN and ATLASCLOUD_CONSOLE_ACCOUNT_ID to auto-convert references to asset:// IDs.",
    );
  }

  const converted = await Promise.all(
    imageUrls.map(async (url, index) => {
      if (url.startsWith("asset://")) return url;
      const created = await createAtlasAssetFromUrl({
        sourceUrl: url,
        name: `reference-${index + 1}`,
        consoleBaseUrl: env.ATLASCLOUD_CONSOLE_BASE_URL,
        accessToken,
        accountId,
      });
      await waitForAtlasAssetReady({
        consoleBaseUrl: env.ATLASCLOUD_CONSOLE_BASE_URL,
        accessToken,
        accountId,
        numericId: created.numericId,
        arkAssetId: created.arkAssetId,
        initialStatus: created.status,
        pollIntervalMs: env.ATLASCLOUD_ASSET_POLL_INTERVAL_MS,
        pollMaxMs: env.ATLASCLOUD_ASSET_POLL_MAX_MS,
      });
      return created.assetRef;
    }),
  );
  return Array.from(new Set(converted));
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = videoRequestSchema.parse(json);
    const candidates = [
      body.imageDataUrlOrUrl,
      ...(body.referenceImageUrls ?? []),
    ].filter(Boolean);
    const resolved = await Promise.all(
      candidates.map((candidate) => resolveImageUrl(candidate, req)),
    );
    const imageUrls = Array.from(new Set(resolved.filter(Boolean))) as string[];

    if (!imageUrls.length) {
      throw new Error("Could not resolve image URL for video generation");
    }

    const env = getEnv();
    const preparedImageRefs =
      canAutoAssetize(env) && imageUrls.some((url) => !url.startsWith("asset://"))
        ? await assetizeImageUrls(imageUrls)
        : imageUrls;

    let result;
    try {
      result = await waitForVideoFromScriptAndImageUrl({
        scriptTitle: body.scriptTitle,
        scriptBody: body.scriptBody,
        imageUrls: preparedImageRefs,
      });
    } catch (err) {
      if (!isRealPersonPolicyError(err) || !canAutoAssetize(env)) {
        throw err;
      }
      const assetRefs = await assetizeImageUrls(preparedImageRefs);
      result = await waitForVideoFromScriptAndImageUrl({
        scriptTitle: body.scriptTitle,
        scriptBody: body.scriptBody,
        imageUrls: assetRefs,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message = normalizeAtlasVideoError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
