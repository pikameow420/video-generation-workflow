export const CHARACTER_SHEET_BASE_RULES = [
  "Create a single professional 3x3 storyboard grid image for use as a reference image for AI video.",
  "Character consistency requirements:",
  "- Lock one identity: same face structure, hairstyle, body proportions, age range, and outfit pieces across all panels.",
  "- Do not introduce alternate costumes, hair colors, or accessories unless explicitly requested.",
  "- Keep the character fully visible and readable for downstream video conditioning in all 9 frames.",
  "Layout requirements:",
  "- Exactly 9 panels arranged in a 3x3 grid.",
  "- EACH panel must be strict 9:16 portrait frame ratio (this is mandatory).",
  "- Use clear panel boundaries and consistent spacing.",
  "- Cohesive character + scene vibe matching the script below.",
  "- Cinematic keyframe style, clean composition, no text labels.",
] as const;

export function buildCharacterSheetPrompt(input: {
  scriptTitle: string;
  scriptBody: string;
  artDirection?: string;
  referenceImageUrls?: string[];
}): string {
  const extra = input.artDirection?.trim();
  const refs = input.referenceImageUrls?.filter(Boolean) ?? [];
  return [
    ...CHARACTER_SHEET_BASE_RULES,
    refs.length
      ? "Reference image grounding requirements (using attached reference images):"
      : null,
    ...refs.map(
      (_url, index) =>
        `- Use attached reference image ${index + 1} as a visual identity anchor.`,
    ),
    refs.length
      ? "- Preserve the same core character identity and style from all attached references."
      : null,
    "",
    `Script title: ${input.scriptTitle}`,
    `Script (for vibe): ${input.scriptBody}`,
    extra ? `Art direction: ${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
