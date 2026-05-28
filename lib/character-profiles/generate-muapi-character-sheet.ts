import "server-only";

import {
  getCharacterProfileSheetContext,
  saveMuapiCharacterSheet,
} from "@/lib/character-profiles/store";
import {
  generateMuapiCharacterSheet,
  prepareMuapiAnchorUrls,
} from "@/lib/muapi/character-sheet";
import type { CharacterProfile } from "@/lib/schemas";

export class MuapiCharacterSheetInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MuapiCharacterSheetInputError";
  }
}

export async function generateMuapiCharacterSheetForProfile(
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
    throw new MuapiCharacterSheetInputError(
      "Add at least one anchor reference photo before generating a character sheet.",
    );
  }

  const anchorUrls = await prepareMuapiAnchorUrls(
    anchorIds,
    userId,
    options.requestUrl,
  );

  const outfitPrompt =
    context.artDirection.trim() ||
    `Consistent outfit and style for character "${context.name}".`;

  const { requestId, sheetImageUrl } = await generateMuapiCharacterSheet({
    anchorImageUrls: anchorUrls,
    outfitPrompt,
    characterName: context.name,
  });

  const sheetRes = await fetch(sheetImageUrl);
  if (!sheetRes.ok) {
    throw new Error(`Failed to download character sheet (${sheetRes.status})`);
  }
  const mimeType = sheetRes.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await sheetRes.arrayBuffer());

  return saveMuapiCharacterSheet(
    profileId,
    { requestId, bytes, mimeType },
    userId,
  );
}
