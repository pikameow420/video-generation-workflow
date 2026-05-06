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
