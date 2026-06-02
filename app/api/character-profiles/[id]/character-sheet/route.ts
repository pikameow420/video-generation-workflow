import { NextResponse } from "next/server";
import { parseErrorMessage } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { AnchorReferenceNotFoundError } from "@/lib/character-profiles/errors";
import {
  CharacterProfileSheetInputError,
  generateCharacterProfileSheetForProfile,
} from "@/lib/character-profiles/generate-character-profile-sheet";
import { CharacterProfileNotFoundError } from "@/lib/character-profiles/store";
import { getEnv } from "@/lib/env";
import { characterSheetRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const env = getEnv();
    if (!env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "Character sheet generation is not configured on the server." },
        { status: 503 },
      );
    }

    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const parsed = characterSheetRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const updated = await generateCharacterProfileSheetForProfile(
      id,
      auth.user.id,
      {
        referenceImageIds: parsed.data.referenceImageIds,
        requestUrl: req.url,
      },
    );

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof CharacterProfileNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (
      err instanceof CharacterProfileSheetInputError ||
      err instanceof AnchorReferenceNotFoundError
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = parseErrorMessage(err, "Failed to generate character sheet");
    const status =
      message.includes("OPENAI_API_KEY") || message.includes("not configured")
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
