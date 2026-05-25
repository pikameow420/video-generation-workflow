import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  characterProfileListResponseSchema,
  createCharacterProfileFieldsSchema,
} from "@/lib/schemas";
import {
  CharacterProfileNotFoundError,
  createCharacterProfile,
  deleteCharacterProfile,
  listCharacterProfiles,
} from "@/lib/character-profiles/store";
import { readVoiceSampleFromForm } from "@/lib/character-profiles/voice-form";
import { requireUser } from "@/lib/auth/require-user";

const deleteQuerySchema = z.object({
  id: z.uuid(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

function parseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => issue.message).join("; ");
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const items = await listCharacterProfiles(auth.user.id);
    const validated = characterProfileListResponseSchema.parse({ items });
    return NextResponse.json(validated);
  } catch (err) {
    return NextResponse.json(
      { error: parseErrorMessage(err, "Failed to list character profiles") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

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
    const fields = createCharacterProfileFieldsSchema.parse(parsedPayload);

    const voice = await readVoiceSampleFromForm(form);
    if (voice.error) {
      return NextResponse.json({ error: voice.error }, { status: 400 });
    }

    const created = await createCharacterProfile(
      {
        name: fields.name,
        artDirection: fields.artDirection,
        referenceImageIds: fields.referenceImageIds,
        voiceSample: voice.voiceSample,
      },
      auth.user.id,
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = parseErrorMessage(err, "Failed to create character profile");
    const status = err instanceof ZodError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const parsed = deleteQuerySchema.safeParse({
      id: url.searchParams.get("id"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 },
      );
    }

    await deleteCharacterProfile(parsed.data.id, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof CharacterProfileNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: parseErrorMessage(err, "Failed to delete character profile") },
      { status: 500 },
    );
  }
}
