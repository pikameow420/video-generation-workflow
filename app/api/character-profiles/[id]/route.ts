import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  characterProfileSchema,
  updateCharacterProfileFieldsSchema,
} from "@/lib/schemas";
import {
  CharacterProfileNotFoundError,
  updateCharacterProfile,
} from "@/lib/character-profiles/store";
import { readVoiceSampleFromForm } from "@/lib/character-profiles/voice-form";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const maxDuration = 60;

const idSchema = z.uuid();

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

    const form = await req.formData();
    const rawPayload = form.get("payload");
    if (typeof rawPayload !== "string") {
      return NextResponse.json(
        { error: "payload is required as a JSON string form field" },
        { status: 400 },
      );
    }
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      return NextResponse.json(
        { error: "payload must be valid JSON" },
        { status: 400 },
      );
    }
    const fields = updateCharacterProfileFieldsSchema.parse(parsedPayload);

    const voice = await readVoiceSampleFromForm(form);
    if (voice.error) {
      return NextResponse.json({ error: voice.error }, { status: 400 });
    }

    const updated = await updateCharacterProfile(
      parsedId.data,
      {
        name: fields.name,
        artDirection: fields.artDirection,
        referenceImageIds: fields.referenceImageIds,
        voiceSample: voice.voiceSample,
        removeVoiceSample: fields.removeVoiceSample,
      },
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
      err instanceof Error ? err.message : "Failed to update character profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
