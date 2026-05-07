import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";

type GenerateCharacterSheetInput = {
  prompt: string;
  requestUrl: string;
  referenceImageUrls?: string[];
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  output_format?: "png" | "jpeg" | "webp";
};

function pickConfigValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "undefined") return fallback;
  return trimmed;
}

function mimeFromOutputFormat(format: string | undefined): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("png")) return "png";
  return "bin";
}

function mimeFromPathname(pathname: string): string {
  const ext = path.extname(pathname).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

function parseDataUrl(raw: string): { mimeType: string; bytes: ArrayBuffer } | null {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(raw.trim());
  if (!match) return null;
  const mimeType = match[1];
  const b64 = match[2].replace(/\s/g, "");
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return { mimeType, bytes: arrayBuffer };
}

async function fileFromReference(raw: string, requestUrl: string): Promise<File> {
  const trimmed = raw.trim();
  const dataUrl = parseDataUrl(trimmed);
  if (dataUrl) {
    const ext = extensionFromMime(dataUrl.mimeType);
    return new File([dataUrl.bytes], `reference.${ext}`, { type: dataUrl.mimeType });
  }

  if (trimmed.startsWith("/")) {
    const absolutePath = path.resolve(process.cwd(), "public", trimmed.replace(/^\/+/, ""));
    const bytes = await readFile(absolutePath);
    const mimeType = mimeFromPathname(absolutePath);
    const name = path.basename(absolutePath) || `reference.${extensionFromMime(mimeType)}`;
    return new File([bytes], name, { type: mimeType });
  }

  const url = /^https?:\/\//.test(trimmed) ? trimmed : new URL(trimmed, requestUrl).toString();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download reference image (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? mimeFromPathname(new URL(url).pathname);
  const name = path.basename(new URL(url).pathname) || `reference.${extensionFromMime(mimeType)}`;
  return new File([bytes], name, { type: mimeType });
}

async function readOpenAiImageResponse(res: Response): Promise<OpenAiImageResponse> {
  const text = await res.text();
  let parsed: OpenAiImageResponse | null = null;
  try {
    parsed = JSON.parse(text) as OpenAiImageResponse;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    throw new Error(`OpenAI image request failed (${res.status}): ${text}`);
  }
  if (!parsed) {
    throw new Error("OpenAI image request returned invalid JSON");
  }
  return parsed;
}

async function resolveImageDataUrlFromResponse(
  response: OpenAiImageResponse,
  fallbackOutputFormat: "png" | "jpeg" | "webp",
): Promise<{ mimeType: string; dataUrl: string }> {
  const first = response.data?.[0];
  if (!first) {
    throw new Error("OpenAI image request returned no image data");
  }

  if (first.b64_json) {
    const format = response.output_format ?? fallbackOutputFormat;
    const mimeType = mimeFromOutputFormat(format);
    return {
      mimeType,
      dataUrl: `data:${mimeType};base64,${first.b64_json}`,
    };
  }

  if (first.url) {
    const imageRes = await fetch(first.url);
    if (!imageRes.ok) {
      throw new Error("Failed to download generated OpenAI image URL");
    }
    const buf = Buffer.from(await imageRes.arrayBuffer());
    const mimeType = imageRes.headers.get("content-type") ?? "image/png";
    return {
      mimeType,
      dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
    };
  }

  throw new Error("OpenAI image response missing both b64_json and url");
}

export async function generateCharacterSheetWithOpenAI(
  input: GenerateCharacterSheetInput,
): Promise<{ mimeType: string; dataUrl: string }> {
  const env = getEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is required for image generation");
  }

  const referenceUrls = (input.referenceImageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const model = pickConfigValue(env.OPENAI_IMAGE_MODEL, "gpt-image-1.5");
  const size = pickConfigValue(env.OPENAI_IMAGE_SIZE, "1024x1536");
  const quality = pickConfigValue(env.OPENAI_IMAGE_QUALITY, "auto");
  const outputFormat = (
    ["png", "jpeg", "webp"].includes(env.OPENAI_IMAGE_OUTPUT_FORMAT)
      ? env.OPENAI_IMAGE_OUTPUT_FORMAT
      : "png"
  ) as "png" | "jpeg" | "webp";
  const fallbackOutputFormat = outputFormat;

  if (!referenceUrls.length) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        n: 1,
        size,
        quality,
        output_format: outputFormat,
      }),
    });
    const response = await readOpenAiImageResponse(res);
    return resolveImageDataUrlFromResponse(response, fallbackOutputFormat);
  }

  const files = await Promise.all(
    referenceUrls.map((url) => fileFromReference(url, input.requestUrl)),
  );
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", input.prompt);
  form.set("size", size);
  form.set("quality", quality);
  form.set("output_format", outputFormat);
  files.forEach((file) => form.append("image[]", file));

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  const response = await readOpenAiImageResponse(res);
  return resolveImageDataUrlFromResponse(response, fallbackOutputFormat);
}
