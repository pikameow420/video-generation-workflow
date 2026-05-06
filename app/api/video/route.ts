import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { videoRequestSchema } from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import {
  uploadMediaFile,
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
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return { remoteUrl: trimmed };
  }

  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (!m) {
    throw new Error(
      "imageDataUrlOrUrl must be a data:image/...;base64,... value or an https image URL",
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

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = videoRequestSchema.parse(json);
    const ref = parseImageRef(body.imageDataUrlOrUrl);
    if (!ref.remoteUrl && body.imageDataUrlOrUrl.trim().startsWith("/")) {
      ref.remoteUrl = new URL(body.imageDataUrlOrUrl.trim(), req.url).toString();
    }


    let imageUrl = ref.remoteUrl;

    if (ref.buffer && ref.mime && ref.filename) {
      const env = getEnv();
      const apiKey = env.ATLASCLOUD_API_KEY;
      if (!apiKey?.trim()) {
        return NextResponse.json(
          {
            error:
              "ATLASCLOUD_API_KEY is required to upload the character sheet image",
          },
          { status: 500 },
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

    if (!imageUrl) {
      throw new Error("Could not resolve image URL for video generation");
    }

    const result = await waitForVideoFromScriptAndImageUrl({
      scriptTitle: body.scriptTitle,
      scriptBody: body.scriptBody,
      imageUrl,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to generate video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
