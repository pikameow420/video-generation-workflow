import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseErrorMessage } from "@/lib/api/errors";
import {
  characterProfileListResponseSchema,
  createCharacterProfileFieldsSchema,
} from "@/lib/schemas";
import {
  createCharacterProfile,
  listCharacterProfiles,
} from "@/lib/character-profiles/store";
import { readVoiceSampleFromForm } from "@/lib/character-profiles/voice-form";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const maxDuration = 60;

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
