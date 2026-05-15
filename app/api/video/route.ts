import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { maxMuapiAudioBytesPerFile, videoRequestSchema, type VideoProvider } from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import { parseMuapiAudioDataUrl } from "@/lib/muapi/audio-data-url";
import { uploadMuapiFile, waitForMuapiVideoFromScriptAndImageUrls } from "@/lib/muapi/client";
import {
  createAtlasAssetFromUrl,
  uploadMediaFile,
  waitForAtlasAssetReady,
  waitForVideoFromScriptAndImageUrl,
} from "@/lib/seedance/client";
import { ingestRemotePipelineVideo } from "@/lib/uploads/pipeline-video-store";

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

function shouldRehostRemoteImage(url: URL): boolean {
  return (
    url.protocol === "http:" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname.endsWith(".local")
  );
}

async function uploadRemoteImageForProvider(
  sourceUrl: string,
  env: ReturnType<typeof getEnv>,
  provider: VideoProvider,
): Promise<string> {
  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) {
    throw new Error(`Failed to download reference image (${sourceRes.status})`);
  }
  const contentType = sourceRes.headers.get("content-type") ?? "image/png";
  const ext = extensionFromMime(contentType);
  const bytes = Buffer.from(await sourceRes.arrayBuffer());

  if (provider === "atlas") {
    const apiKey = env.ATLASCLOUD_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "ATLASCLOUD_API_KEY is required to upload reference images for video generation",
      );
    }
    const { downloadUrl } = await uploadMediaFile({
      buffer: bytes,
      filename: `reference.${ext}`,
      contentType,
      apiKey,
      baseUrl: env.ATLASCLOUD_BASE_URL,
    });
    return downloadUrl;
  }

  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "MUAPI_API_KEY is required to upload reference images for video generation",
    );
  }
  const { url } = await uploadMuapiFile({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    buffer: bytes,
    filename: `reference.${ext}`,
    contentType,
  });
  return url;
}

async function resolveImageUrl(
  raw: string,
  req: Request,
  provider: VideoProvider,
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
    if (provider === "atlas") {
      const apiKey = env.ATLASCLOUD_API_KEY?.trim();
      if (!apiKey) {
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
    } else {
      const apiKey = env.MUAPI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error(
          "MUAPI_API_KEY is required to upload reference images for video generation",
        );
      }
      const { url } = await uploadMuapiFile({
        apiKey,
        baseUrl: env.MUAPI_BASE_URL,
        buffer: ref.buffer,
        filename: ref.filename,
        contentType: ref.mime,
      });
      imageUrl = url;
    }
  }
  if (imageUrl) {
    const url = new URL(imageUrl);
    if (shouldRehostRemoteImage(url)) {
      imageUrl = await uploadRemoteImageForProvider(imageUrl.toString(), env, provider);
    }
  }
  return imageUrl;
}

function normalizeVideoError(err: unknown): string {
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

function httpStatusForVideoError(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("timed out waiting for muapi")) return 504;

  const likelyClient =
    lower.includes("could not resolve image url") ||
    lower.includes("must be a data:image") ||
    lower.includes("must be data:audio") ||
    lower.includes("audio sample") ||
    lower.includes("muapi_api_key is required") ||
    lower.includes("atlascloud_api_key is required") ||
    lower.includes("insufficient credits") ||
    lower.includes("rate limited") ||
    lower.includes("upload_file failed") ||
    lower.includes("uploadmedia failed") ||
    lower.includes("muapi upload_file") ||
    lower.includes("atlas blocked") ||
    lower.includes("real person");

  return likelyClient ? 400 : 500;
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

async function persistGeneratedVideo(result: {
  videoUrl: string;
  predictionId: string;
}): Promise<{ videoUrl: string; predictionId: string }> {
  const saved = await ingestRemotePipelineVideo({
    sourceUrl: result.videoUrl,
    predictionId: result.predictionId,
  });
  return { videoUrl: saved.url, predictionId: result.predictionId };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = videoRequestSchema.parse(json);
    const env = getEnv();
    const provider = body.provider ?? env.VIDEO_PROVIDER;

    if (body.audioDataUrls?.length && provider !== "muapi") {
      return NextResponse.json(
        {
          error:
            "Audio reference samples are only supported with the MuAPI (720p) video backend.",
        },
        { status: 400 },
      );
    }

    if (provider === "atlas" && !env.ATLASCLOUD_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "Atlas Cloud video generation requires ATLASCLOUD_API_KEY on the server.",
        },
        { status: 400 },
      );
    }
    if (provider === "muapi" && !env.MUAPI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error: "MuAPI video generation requires MUAPI_API_KEY on the server.",
        },
        { status: 400 },
      );
    }

    const sheetImageUrl = await resolveImageUrl(
      body.imageDataUrlOrUrl,
      req,
      provider,
    );
    const imageUrls = sheetImageUrl ? [sheetImageUrl] : [];

    if (!imageUrls.length) {
      throw new Error("Could not resolve image URL for video generation");
    }

    if (provider === "muapi") {
      if (imageUrls.some((u) => u.startsWith("asset://"))) {
        return NextResponse.json(
          {
            error:
              "MuAPI needs public HTTPS image URLs. Atlas-only asset:// references cannot be used. Choose Atlas as the video provider, or use hosted references instead.",
          },
          { status: 400 },
        );
      }

      const audioUrls: string[] = [];
      if (body.audioDataUrls?.length) {
        const apiKey = env.MUAPI_API_KEY!.trim();
        for (let i = 0; i < body.audioDataUrls.length; i++) {
          const parsed = parseMuapiAudioDataUrl(body.audioDataUrls[i]!, i);
          if (parsed.buffer.length > maxMuapiAudioBytesPerFile) {
            return NextResponse.json(
              {
                error: `Audio sample ${i + 1} is too large (max ${Math.round(
                  maxMuapiAudioBytesPerFile / (1024 * 1024),
                )}MB per file).`,
              },
              { status: 400 },
            );
          }
          const { url } = await uploadMuapiFile({
            apiKey,
            baseUrl: env.MUAPI_BASE_URL,
            buffer: parsed.buffer,
            filename: parsed.filename,
            contentType: parsed.contentType,
          });
          audioUrls.push(url);
        }
      }

      const result = await waitForMuapiVideoFromScriptAndImageUrls({
        scriptTitle: body.scriptTitle,
        scriptBody: body.scriptBody,
        imageUrls,
        audioUrls: audioUrls.length ? audioUrls : undefined,
      });
      return NextResponse.json(await persistGeneratedVideo(result));
    }

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

    return NextResponse.json(await persistGeneratedVideo(result));
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message = normalizeVideoError(err);
    const status = httpStatusForVideoError(message);
    return NextResponse.json({ error: message }, { status });
  }
}
