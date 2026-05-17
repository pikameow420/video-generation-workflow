/**
 * MuAPI — Seedance 2 Omni Reference (and related) video generation.
 * @see https://muapi.ai/docs/authentication
 * @see https://api.muapi.ai/openapi.json (default /api/v1/seedance-2-omni-reference-no-video-fast)
 */

import { getEnv } from "@/lib/env";
import { buildMuapiOmniReferencePrompt } from "@/lib/prompts/video";

function apiV1Root(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/v1`;
}

function extractUploadUrl(json: Record<string, unknown>): string {
  const u =
    json.url ??
    json.file_url ??
    json.output ??
    (typeof json.data === "object" &&
    json.data !== null &&
    "url" in json.data &&
    typeof (json.data as { url?: unknown }).url === "string"
      ? (json.data as { url: string }).url
      : undefined);
  if (!u || typeof u !== "string") {
    throw new Error(`MuAPI upload_file: missing URL in response (${JSON.stringify(json)})`);
  }
  return u;
}

export async function uploadMuapiFile(params: {
  apiKey: string;
  baseUrl: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<{ url: string }> {
  const root = apiV1Root(params.baseUrl);
  const file = new File(
    [new Uint8Array(params.buffer)],
    params.filename,
    { type: params.contentType },
  );
  const form = new FormData();
  form.set("file", file);

  const res = await fetch(`${root}/upload_file`, {
    method: "POST",
    headers: { "x-api-key": params.apiKey },
    body: form,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    throw new Error(`MuAPI upload_file failed (${res.status}): ${text || res.statusText}`);
  }

  return { url: extractUploadUrl(json) };
}

function extractRequestId(json: Record<string, unknown>): string {
  const id =
    json.request_id ??
    json.requestId ??
    json.id ??
    (typeof json.data === "object" &&
    json.data !== null &&
    "request_id" in json.data
      ? (json.data as { request_id?: string }).request_id
      : undefined);
  if (!id || typeof id !== "string") {
    throw new Error(
      `MuAPI job start: missing request_id (${JSON.stringify(json).slice(0, 500)})`,
    );
  }
  return id;
}

export async function startMuapiOmniReferenceJob(params: {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  prompt: string;
  imageUrls: string[];
  aspectRatio: string;
  duration: number;
  /** Public HTTPS URLs from MuAPI `upload_file`, same order as @audioN in prompt. */
  audioFileUrls?: string[];
}): Promise<string> {
  const root = apiV1Root(params.baseUrl);
  const path = params.endpoint.replace(/^\/+/, "");
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    images_list: params.imageUrls.length ? params.imageUrls : null,
    aspect_ratio: params.aspectRatio,
    duration: params.duration,
  };
  const audio = params.audioFileUrls?.filter(Boolean) ?? [];
  if (audio.length) {
    body.audio_files = audio;
  }

  const res = await fetch(`${root}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    if (res.status === 402) {
      throw new Error("MuAPI: insufficient credits — add balance at muapi.ai");
    }
    if (res.status === 429) {
      throw new Error("MuAPI: rate limited — retry later.");
    }
    throw new Error(`MuAPI ${path} failed (${res.status}): ${text || res.statusText}`);
  }

  return extractRequestId(json);
}

export type MuapiPredictionResult = {
  status?: string;
  outputs?: unknown;
  output?: unknown;
  error?: unknown;
  video_url?: string;
  url?: string;
};

export async function getMuapiPredictionResult(params: {
  apiKey: string;
  baseUrl: string;
  requestId: string;
}): Promise<{ ok: boolean; data: MuapiPredictionResult }> {
  const root = apiV1Root(params.baseUrl);
  const res = await fetch(`${root}/predictions/${encodeURIComponent(params.requestId)}/result`, {
    headers: { "x-api-key": params.apiKey },
  });

  const text = await res.text();
  let data: MuapiPredictionResult = {};
  try {
    data = JSON.parse(text) as MuapiPredictionResult;
  } catch {
    data = { error: text || "invalid JSON" };
  }

  // 400 is used while the job is still processing (see MuAPI ComfyUI client).
  if (res.ok || res.status === 400) {
    return { ok: true, data };
  }

  if (res.status === 402) {
    return {
      ok: false,
      data: { status: "failed", error: "MuAPI: insufficient credits — add balance at muapi.ai" },
    };
  }

  return {
    ok: false,
    data: {
      status: "failed",
      error: `MuAPI prediction failed (${res.status}): ${text || res.statusText}`,
    },
  };
}

function extractVideoUrl(result: MuapiPredictionResult): string | undefined {
  const outs = result.outputs ?? result.output;
  if (Array.isArray(outs) && outs.length && typeof outs[0] === "string") {
    return outs[0];
  }
  if (typeof outs === "string") return outs;
  if (result.video_url && typeof result.video_url === "string") return result.video_url;
  if (result.url && typeof result.url === "string") return result.url;
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Video generation failed";
}

export type VideoPollOutcome =
  | { status: "processing" }
  | { status: "completed"; videoUrl: string }
  | { status: "failed"; error: string };

export async function startMuapiVideoJob(options: {
  scriptTitle: string;
  scriptBody: string;
  imageUrls: string[];
  audioUrls?: string[];
}): Promise<string> {
  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required for MuAPI video generation");
  }

  const audioUrls = options.audioUrls?.filter(Boolean) ?? [];
  const prompt = buildMuapiOmniReferencePrompt(
    options.scriptTitle,
    options.scriptBody,
    options.imageUrls.length,
    audioUrls.length,
  );

  return startMuapiOmniReferenceJob({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    endpoint: env.MUAPI_VIDEO_ENDPOINT,
    prompt,
    imageUrls: options.imageUrls,
    aspectRatio: env.MUAPI_VIDEO_ASPECT_RATIO,
    duration: env.MUAPI_VIDEO_DURATION,
    audioFileUrls: audioUrls.length ? audioUrls : undefined,
  });
}

export async function pollMuapiVideoOnce(
  requestId: string,
): Promise<VideoPollOutcome> {
  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required for MuAPI video generation");
  }

  const { ok, data } = await getMuapiPredictionResult({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    requestId,
  });

  if (!ok) {
    return { status: "failed", error: extractErrorMessage(data.error) };
  }

  const status = String(data.status ?? "").toLowerCase();
  if (status === "completed" || status === "succeeded") {
    const videoUrl = extractVideoUrl(data);
    if (!videoUrl) {
      return {
        status: "failed",
        error: "MuAPI returned success but no video URL was found in outputs",
      };
    }
    return { status: "completed", videoUrl };
  }

  if (status === "failed") {
    return { status: "failed", error: extractErrorMessage(data.error) };
  }

  return { status: "processing" };
}

export async function waitForMuapiVideoFromScriptAndImageUrls(options: {
  scriptTitle: string;
  scriptBody: string;
  imageUrls: string[];
  /** Public URLs from MuAPI upload_file, max 3 — order matches @audio1…@audio3. */
  audioUrls?: string[];
}): Promise<{ videoUrl: string; predictionId: string }> {
  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required for MuAPI video generation");
  }

  const audioUrls = options.audioUrls?.filter(Boolean) ?? [];
  const prompt = buildMuapiOmniReferencePrompt(
    options.scriptTitle,
    options.scriptBody,
    options.imageUrls.length,
    audioUrls.length,
  );

  const requestId = await startMuapiOmniReferenceJob({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    endpoint: env.MUAPI_VIDEO_ENDPOINT,
    prompt,
    imageUrls: options.imageUrls,
    aspectRatio: env.MUAPI_VIDEO_ASPECT_RATIO,
    duration: env.MUAPI_VIDEO_DURATION,
    audioFileUrls: audioUrls.length ? audioUrls : undefined,
  });

  const deadline = Date.now() + env.MUAPI_POLL_MAX_MS;
  while (Date.now() < deadline) {
    const { ok, data } = await getMuapiPredictionResult({
      apiKey,
      baseUrl: env.MUAPI_BASE_URL,
      requestId,
    });

    if (!ok) {
      throw new Error(extractErrorMessage(data.error));
    }

    const status = String(data.status ?? "").toLowerCase();
    if (status === "completed" || status === "succeeded") {
      const videoUrl = extractVideoUrl(data);
      if (!videoUrl) {
        throw new Error("MuAPI returned success but no video URL was found in outputs");
      }
      return { videoUrl, predictionId: requestId };
    }

    if (status === "failed") {
      throw new Error(extractErrorMessage(data.error));
    }

    await new Promise((r) => setTimeout(r, env.MUAPI_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for MuAPI video generation");
}
