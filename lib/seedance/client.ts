/**
 * Seedance 2.0 image-to-video via Atlas Cloud (ByteDance model hosted on Atlas).
 * @see https://www.atlascloud.ai/models/bytedance/seedance-2.0/reference-to-video?tab=api
 */

import { getEnv } from "@/lib/env";
import { buildVideoPrompt } from "@/lib/prompts/video";


export async function uploadMediaFile(params: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  apiKey: string;
  baseUrl: string;
}): Promise<{ downloadUrl: string }> {
  const file = new File(
    [new Uint8Array(params.buffer)],
    params.filename,
    { type: params.contentType },
  );
  const form = new FormData();
  form.set("file", file);

  const res = await fetch(`${params.baseUrl}/api/v1/model/uploadMedia`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlas uploadMedia failed (${res.status}): ${text}`);
  }

  const json: unknown = await res.json();
  const rec = json as { data?: { download_url?: string } };
  const url = rec.data?.download_url;
  if (!url) {
    throw new Error("Atlas uploadMedia: missing data.download_url");
  }
  return { downloadUrl: url };
}

export async function createAtlasAssetFromUrl(params: {
  sourceUrl: string;
  name: string;
  consoleBaseUrl: string;
  accessToken: string;
  accountId: string;
}): Promise<{
  assetRef: string;
  status?: string;
  numericId?: number;
  arkAssetId?: string;
}> {
  const res = await fetch(`${params.consoleBaseUrl}/api/v1/sd/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-account-id": params.accountId,
      Authorization: `Bearer ${params.accessToken}`,
      Cookie: `access-token=${params.accessToken}`,
    },
    body: JSON.stringify({
      url: params.sourceUrl,
      name: params.name,
    }),
  });

  const text = await res.text();
  let parsed:
    | {
        code?: string | number;
        data?: { ark_asset_id?: string; status?: string; id?: number };
      }
    | null = null;
  try {
    parsed = JSON.parse(text) as {
      code?: string | number;
      data?: { ark_asset_id?: string; status?: string; id?: number };
    };
  } catch {
    parsed = null;
  }

  if (!res.ok || !parsed) {
    throw new Error(`Atlas asset create failed (${res.status}): ${text}`);
  }

  const code = String(parsed.code ?? "");
  if (code && code !== "200") {
    throw new Error(`Atlas asset create failed (${res.status}): ${text}`);
  }

  const arkAssetId = parsed.data?.ark_asset_id;
  if (!arkAssetId) {
    throw new Error("Atlas asset create: missing data.ark_asset_id");
  }
  return {
    assetRef: `asset://${arkAssetId}`,
    status: parsed.data?.status,
    numericId: parsed.data?.id,
    arkAssetId,
  };
}

type AtlasAssetStatusResult = {
  status?: string;
  arkAssetId?: string;
  numericId?: number;
};

function normalizeAssetStatus(status: string | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function isAssetReady(status: string | undefined): boolean {
  const value = normalizeAssetStatus(status);
  return (
    value === "active" ||
    value === "ready" ||
    value === "completed" ||
    value === "succeeded" ||
    value === "success"
  );
}

function isAssetFailed(status: string | undefined): boolean {
  const value = normalizeAssetStatus(status);
  return value === "failed" || value === "error" || value === "rejected";
}

async function readAssetStatusViaEndpoint(
  endpoint: string,
  params: {
    accessToken: string;
    accountId: string;
  },
): Promise<AtlasAssetStatusResult | null> {
  const res = await fetch(endpoint, {
    headers: {
      "x-account-id": params.accountId,
      Authorization: `Bearer ${params.accessToken}`,
      Cookie: `access-token=${params.accessToken}`,
    },
  });
  if (!res.ok) return null;

  const text = await res.text();
  let parsed:
    | {
        data?:
          | { status?: string; ark_asset_id?: string }
          | Array<{ status?: string; ark_asset_id?: string }>;
      }
    | null = null;
  try {
    parsed = JSON.parse(text) as {
      data?:
        | { status?: string; ark_asset_id?: string }
        | Array<{ status?: string; ark_asset_id?: string }>;
    };
  } catch {
    return null;
  }

  if (!parsed?.data) return null;
  const first = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
  if (!first) return null;
  return {
    status: first.status,
    arkAssetId: first.ark_asset_id,
  };
}

async function readAssetStatusFromPagedList(params: {
  consoleBaseUrl: string;
  accessToken: string;
  accountId: string;
  pageSize: number;
  numericId?: number;
  arkAssetId?: string;
}): Promise<AtlasAssetStatusResult | null> {
  const base = params.consoleBaseUrl.replace(/\/+$/, "");
  const headers = {
    "x-account-id": params.accountId,
    Authorization: `Bearer ${params.accessToken}`,
    Cookie: `access-token=${params.accessToken}`,
  };

  let pageNumber = 1;
  let totalCount = 0;
  do {
    const endpoint = `${base}/api/v1/sd/assets?page_number=${pageNumber}&page_size=${params.pageSize}`;
    const res = await fetch(endpoint, { headers });
    if (!res.ok) return null;
    const text = await res.text();
    let parsed:
      | {
          data?: {
            items?: Array<{
              id?: number;
              ark_asset_id?: string;
              status?: string;
            }>;
            total_count?: number;
            page_number?: number;
            page_size?: number;
          };
        }
      | null = null;
    try {
      parsed = JSON.parse(text) as {
        data?: {
          items?: Array<{
            id?: number;
            ark_asset_id?: string;
            status?: string;
          }>;
          total_count?: number;
          page_number?: number;
          page_size?: number;
        };
      };
    } catch {
      return null;
    }

    const items = parsed?.data?.items ?? [];
    const match = items.find((item) => {
      if (params.numericId && item.id === params.numericId) return true;
      if (params.arkAssetId && item.ark_asset_id === params.arkAssetId) return true;
      return false;
    });
    if (match) {
      return {
        status: match.status,
        arkAssetId: match.ark_asset_id,
        numericId: match.id,
      };
    }

    totalCount = parsed?.data?.total_count ?? 0;
    const pageSize = parsed?.data?.page_size ?? params.pageSize;
    const pageCount = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
    pageNumber += 1;
    if (pageNumber > pageCount) break;
  } while (true);

  return null;
}

export async function waitForAtlasAssetReady(params: {
  consoleBaseUrl: string;
  accessToken: string;
  accountId: string;
  numericId?: number;
  arkAssetId?: string;
  pollIntervalMs: number;
  pollMaxMs: number;
  initialStatus?: string;
}): Promise<void> {
  if (isAssetReady(params.initialStatus)) return;
  if (isAssetFailed(params.initialStatus)) {
    throw new Error(`Atlas asset status is ${params.initialStatus}`);
  }

  const deadline = Date.now() + params.pollMaxMs;
  while (Date.now() < deadline) {
    if (!params.numericId) {
      await new Promise((r) => setTimeout(r, params.pollIntervalMs));
      continue;
    }

    const byList = await readAssetStatusFromPagedList({
      consoleBaseUrl: params.consoleBaseUrl,
      accessToken: params.accessToken,
      accountId: params.accountId,
      pageSize: 100,
      numericId: params.numericId,
      arkAssetId: params.arkAssetId,
    });
    const base = params.consoleBaseUrl.replace(/\/+$/, "");
    const byId =
      byList ??
      (await readAssetStatusViaEndpoint(
        `${base}/api/v1/sd/assets/${params.numericId ?? ""}`,
        {
          accessToken: params.accessToken,
          accountId: params.accountId,
        },
      ));

    const status = byId?.status;
    if (isAssetReady(status)) return;
    if (isAssetFailed(status)) {
      throw new Error(`Atlas asset status is ${status}`);
    }

    await new Promise((r) => setTimeout(r, params.pollIntervalMs));
  }

  throw new Error("Atlas asset is still processing. Please retry in a minute.");
}

function extractPredictionId(json: unknown): string {
  const rec = json as { data?: { id?: string }; id?: string };
  const id = rec.data?.id ?? rec.id;
  if (!id) {
    throw new Error("Atlas generateVideo: missing prediction id (expected data.id or id)");
  }
  return id;
}

export async function startVideoGeneration(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  imageUrls: string[];
  duration: number;
  width: number;
  height: number;
  fps: number;
}): Promise<string> {
  if (!params.imageUrls.length) {
    throw new Error("At least one reference image URL is required");
  }
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    reference_images: params.imageUrls,
    image_url: params.imageUrls[0],
    image_urls: params.imageUrls,
    width: params.width,
    height: params.height,
    duration: params.duration,
    resolution: getEnv().ATLASCLOUD_VIDEO_RESOLUTION,
    ratio: getEnv().ATLASCLOUD_VIDEO_RATIO,
    fps: params.fps,
  };

  const res = await fetch(`${params.baseUrl}/api/v1/model/generateVideo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlas generateVideo failed (${res.status}): ${text}`);
  }

  const json: unknown = await res.json();
  return extractPredictionId(json);
}

export type PredictionStatus = {
  status: string;
  outputs?: string[];
  error?: string;
};

export async function getPrediction(params: {
  apiKey: string;
  baseUrl: string;
  predictionId: string;
}): Promise<PredictionStatus> {
  const res = await fetch(
    `${params.baseUrl}/api/v1/model/prediction/${params.predictionId}`,
    { headers: { Authorization: `Bearer ${params.apiKey}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Atlas prediction failed (${res.status}): ${text}`);
  }

  const json: unknown = await res.json();
  const rec = json as {
    data?: { status?: string; outputs?: string[]; error?: string };
  };
  const data = rec.data ?? {};
  return {
    status: String(data.status ?? "processing"),
    outputs: data.outputs,
    error: data.error,
  };
}

export type WaitForVideoResult = {
  videoUrl: string;
  predictionId: string;
};

export type VideoPollOutcome =
  | { status: "processing" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string };

export async function startAtlasVideoJob(options: {
  scriptTitle: string;
  scriptBody: string;
  imageUrls: string[];
}): Promise<string> {
  const env = getEnv();
  const apiKey = env.ATLASCLOUD_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "ATLASCLOUD_API_KEY is required (see .env.example)",
    );
  }

  const prompt = buildVideoPrompt(
    options.scriptTitle,
    options.scriptBody,
    options.imageUrls,
  );

  return startVideoGeneration({
    apiKey,
    baseUrl: env.ATLASCLOUD_BASE_URL,
    model: env.ATLASCLOUD_VIDEO_MODEL,
    prompt,
    imageUrls: options.imageUrls,
    duration: env.ATLASCLOUD_VIDEO_DURATION,
    width: env.ATLASCLOUD_VIDEO_WIDTH,
    height: env.ATLASCLOUD_VIDEO_HEIGHT,
    fps: env.ATLASCLOUD_VIDEO_FPS,
  });
}

export async function pollAtlasVideoOnce(
  predictionId: string,
): Promise<VideoPollOutcome> {
  const env = getEnv();
  const apiKey = env.ATLASCLOUD_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "ATLASCLOUD_API_KEY is required (see .env.example)",
    );
  }

  const p = await getPrediction({
    apiKey,
    baseUrl: env.ATLASCLOUD_BASE_URL,
    predictionId,
  });

  if (p.status === "completed" || p.status === "succeeded") {
    const videoUrl = p.outputs?.[0];
    if (!videoUrl) {
      return {
        status: "failed",
        error: "Atlas returned success but outputs[0] was empty",
      };
    }
    return { status: "completed", videoUrl };
  }

  if (p.status === "failed") {
    return { status: "failed", error: p.error || "Video generation failed" };
  }

  return { status: "processing" };
}

export async function waitForVideoFromScriptAndImageUrl(options: {
  scriptTitle: string;
  scriptBody: string;
  imageUrls: string[];
}): Promise<WaitForVideoResult> {
  const env = getEnv();
  const apiKey = env.ATLASCLOUD_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "ATLASCLOUD_API_KEY is required (see .env.example)",
    );
  }

  const prompt = buildVideoPrompt(
    options.scriptTitle,
    options.scriptBody,
    options.imageUrls,
  );

  const predictionId = await startVideoGeneration({
    apiKey,
    baseUrl: env.ATLASCLOUD_BASE_URL,
    model: env.ATLASCLOUD_VIDEO_MODEL,
    prompt,
    imageUrls: options.imageUrls,
    duration: env.ATLASCLOUD_VIDEO_DURATION,
    width: env.ATLASCLOUD_VIDEO_WIDTH,
    height: env.ATLASCLOUD_VIDEO_HEIGHT,
    fps: env.ATLASCLOUD_VIDEO_FPS,
  });

  const deadline = Date.now() + env.ATLASCLOUD_POLL_MAX_MS;
  while (Date.now() < deadline) {
    const p = await getPrediction({
      apiKey,
      baseUrl: env.ATLASCLOUD_BASE_URL,
      predictionId,
    });

    if (p.status === "completed" || p.status === "succeeded") {
      const videoUrl = p.outputs?.[0];
      if (!videoUrl) {
        throw new Error("Atlas returned success but outputs[0] was empty");
      }
      return { videoUrl, predictionId };
    }

    if (p.status === "failed") {
      throw new Error(p.error || "Video generation failed");
    }

    await new Promise((r) => setTimeout(r, env.ATLASCLOUD_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for Atlas video generation");
}
