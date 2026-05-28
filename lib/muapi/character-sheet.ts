/**
 * MuAPI Seedance 2 character sheet (playground: sd-2-character).
 * @see https://muapi.ai/playground/sd-2-character
 */

import { AnchorReferenceNotFoundError } from "@/lib/character-profiles/errors";
import { getEnv } from "@/lib/env";
import { postMuapiJson } from "@/lib/muapi/http";
import { waitForMuapiJobOutput } from "@/lib/muapi/job-utils";
import { uploadMuapiFile } from "@/lib/muapi/client";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";
import {
  downloadReferenceImagesByIds,
  getReferenceImagesByIds,
  ReferenceImageNotFoundError,
} from "@/lib/uploads/store";

export async function startSeedance2CharacterJob(params: {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  imageUrls: string[];
  outfitPrompt: string;
  characterName?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    images_list: params.imageUrls.slice(0, 3),
    prompt: params.outfitPrompt,
  };
  if (params.characterName?.trim()) {
    body.character_name = params.characterName.trim();
  }

  const { requestId } = await postMuapiJson({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    path: params.endpoint,
    body,
    context: "MuAPI character job",
  });
  return requestId;
}

export async function generateMuapiCharacterSheet(options: {
  anchorImageUrls: string[];
  outfitPrompt: string;
  characterName?: string;
}): Promise<{ requestId: string; sheetImageUrl: string }> {
  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required for MuAPI character sheet generation");
  }

  const urls = options.anchorImageUrls.filter(Boolean).slice(0, 3);
  if (!urls.length) {
    throw new Error("At least one anchor photo URL is required");
  }

  const requestId = await startSeedance2CharacterJob({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    endpoint: env.MUAPI_CHARACTER_ENDPOINT,
    imageUrls: urls,
    outfitPrompt: options.outfitPrompt,
    characterName: options.characterName,
  });

  const sheetImageUrl = await waitForMuapiJobOutput(requestId);
  return { requestId, sheetImageUrl };
}

export async function uploadAnchorBytesForMuapi(params: {
  bytes: Uint8Array;
  mimeType: string;
  filename?: string;
}): Promise<string> {
  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required to upload anchor images");
  }

  const contentType = params.mimeType || "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const buffer = Buffer.from(params.bytes);
  const { url } = await uploadMuapiFile({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    buffer,
    filename: params.filename ?? `anchor.${ext}`,
    contentType,
  });
  return url;
}

export async function uploadAnchorUrlForMuapi(
  sourceUrl: string,
  requestUrl: string,
): Promise<string> {
  const trimmed = sourceUrl.trim();
  const absolute =
    trimmed.startsWith("/") && !trimmed.startsWith("//")
      ? new URL(trimmed, requestUrl).toString()
      : trimmed;

  if (absolute.startsWith("https://") || absolute.startsWith("http://")) {
    return absolute;
  }

  const res = await fetch(absolute);
  if (!res.ok) {
    throw new Error(`Failed to download anchor image (${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const buffer = Buffer.from(await res.arrayBuffer());

  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required to upload anchor images");
  }

  const { url } = await uploadMuapiFile({
    apiKey,
    baseUrl: env.MUAPI_BASE_URL,
    buffer,
    filename: `anchor.${ext}`,
    contentType,
  });
  return url;
}

const MAX_MUAPI_ANCHORS = 3;

/** Resolve anchor ids to MuAPI-accessible URLs without signing storage on Supabase. */
export async function prepareMuapiAnchorUrls(
  ids: string[],
  userId: string,
  requestUrl: string,
): Promise<string[]> {
  const anchorIds = [...new Set(ids.filter(Boolean))].slice(0, MAX_MUAPI_ANCHORS);
  if (!anchorIds.length) {
    throw new Error("At least one anchor photo URL is required");
  }

  try {
    if (isSupabasePersistenceEnabled()) {
      const downloaded = await downloadReferenceImagesByIds(anchorIds, userId);
      if (downloaded.length !== anchorIds.length) {
        throw new AnchorReferenceNotFoundError();
      }
      return Promise.all(
        downloaded.map((item) =>
          uploadAnchorBytesForMuapi({
            bytes: item.bytes,
            mimeType: item.mimeType,
            filename: item.originalName,
          }),
        ),
      );
    }

    const records = await getReferenceImagesByIds(anchorIds, userId);
    if (records.length !== anchorIds.length) {
      throw new AnchorReferenceNotFoundError();
    }
    const byId = new Map(records.map((item) => [item.id, item]));
    const ordered = anchorIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    return Promise.all(
      ordered.map((item) => uploadAnchorUrlForMuapi(item.url, requestUrl)),
    );
  } catch (err) {
    if (err instanceof ReferenceImageNotFoundError) {
      throw new AnchorReferenceNotFoundError();
    }
    throw err;
  }
}
