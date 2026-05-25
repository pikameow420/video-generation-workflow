import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  characterProfileSchema,
  saveCharacterProfileSheetRequestSchema,
} from "@/lib/schemas";
import {
  CharacterProfileNotFoundError,
  saveCharacterProfileSheet,
} from "@/lib/character-profiles/store";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const maxDuration = 60;

const idSchema = z.uuid();

const DATA_IMAGE_RE = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/;

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Invalid character profile id" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const body = saveCharacterProfileSheetRequestSchema.parse(json);
    const match = DATA_IMAGE_RE.exec(body.imageDataUrl.trim());
    if (!match) {
      return NextResponse.json(
        { error: "imageDataUrl must be a PNG, JPEG, or WebP data URL" },
        { status: 400 },
      );
    }
    const mimeType = match[1];
    const bytes = Uint8Array.from(Buffer.from(match[2].replace(/\s/g, ""), "base64"));
    if (!bytes.byteLength) {
      return NextResponse.json(
        { error: "imageDataUrl is empty" },
        { status: 400 },
      );
    }

    const updated = await saveCharacterProfileSheet(
      parsedId.data,
      { bytes, mimeType },
      auth.user.id,
    );
    return NextResponse.json(characterProfileSchema.parse(updated));
  } catch (err) {
    if (err instanceof CharacterProfileNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to save profile sheet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
