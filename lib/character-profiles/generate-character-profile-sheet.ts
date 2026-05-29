import "server-only";

import { AnchorReferenceNotFoundError } from "@/lib/character-profiles/errors";
import {
  getCharacterProfileSheetContext,
  saveCharacterProfileSheet,
} from "@/lib/character-profiles/store";
import { generateCharacterProfileSheetWithOpenAI } from "@/lib/openai/images";
import { buildCharacterProfileSheetPrompt } from "@/lib/prompts/character-profile-sheet";
import type { CharacterProfile } from "@/lib/schemas";
import { getReferenceImagesByIds } from "@/lib/uploads/store";

export class CharacterProfileSheetInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterProfileSheetInputError";
  }
}

/** @deprecated Use CharacterProfileSheetInputError */
export const MuapiCharacterSheetInputError = CharacterProfileSheetInputError;

export async function generateCharacterProfileSheetForProfile(
  profileId: string,
  userId: string,
  options: { referenceImageIds?: string[]; requestUrl: string },
): Promise<CharacterProfile> {
  const context = await getCharacterProfileSheetContext(profileId, userId);

  const anchorIds = (
    options.referenceImageIds?.length
      ? options.referenceImageIds
      : context.storedReferenceImageIds
  ).slice(0, 3);

  if (!anchorIds.length) {
    throw new CharacterProfileSheetInputError(
      "Add at least one anchor reference photo before generating a character sheet.",
    );
  }

  const records = await getReferenceImagesByIds(anchorIds, userId);
  if (records.length !== anchorIds.length) {
    throw new AnchorReferenceNotFoundError();
  }

  const anchorUrls = records.map((item) => item.url).filter(Boolean);
  if (!anchorUrls.length) {
    throw new AnchorReferenceNotFoundError();
  }

  const prompt = buildCharacterProfileSheetPrompt({
    characterName: context.name,
    artDirection: context.artDirection,
  });

  const { bytes, mimeType } = await generateCharacterProfileSheetWithOpenAI({
    prompt,
    requestUrl: options.requestUrl,
    referenceImageUrls: anchorUrls,
  });

  return saveCharacterProfileSheet(
    profileId,
    { requestId: null, bytes, mimeType },
    userId,
  );
}

/** @deprecated Use generateCharacterProfileSheetForProfile */
export const generateMuapiCharacterSheetForProfile =
  generateCharacterProfileSheetForProfile;
