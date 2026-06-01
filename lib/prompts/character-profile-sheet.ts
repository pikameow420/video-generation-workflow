export function buildCharacterProfileSheetPrompt(input: {
  characterName: string;
  artDirection: string;
}): string {
  const name = input.characterName.trim() || "Character";
  const style = input.artDirection.trim();

  const styleLine = style
    ? `Art direction: ${style}.`
    : "Keep outfit and styling consistent with the reference photos.";

  return [
    `Create a single professional character reference sheet for "${name}".`,
    "Use the attached reference photo(s) as the identity lock. Preserve face, skin tone, hair, and distinguishing features.",
    styleLine,
    "Layout on one image (clean light background, readable labels):",
    "- Full-body views: front, back, side profile, and one natural action pose.",
    "- A row of facial expressions: neutral, happy, angry, sad.",
    "- Key outfit pieces and accessories shown clearly (flat or on mannequin-style layout).",
    "No text watermarks, no collage of unrelated people, photorealistic consistency.",
  ].join("\n");
}
