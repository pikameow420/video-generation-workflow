import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { parseErrorMessage } from "@/lib/api/errors";
import {
  characterProfileSchema,
  updateCharacterProfileFieldsSchema,
} from "@/lib/schemas";
import {
  CharacterProfileNotFoundError,
  deleteCharacterProfile,
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
        { error: parseErrorMessage(err, "Validation failed") },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: parseErrorMessage(
          err,
          "Failed to update character profile",
        ),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
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

    await deleteCharacterProfile(parsedId.data, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof CharacterProfileNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: parseErrorMessage(
          err,
          "Failed to delete character profile",
        ),
      },
      { status: 500 },
    );
  }
}
