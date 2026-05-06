export const CHARACTER_SHEET_BASE_RULES = [
  "Create a single professional 3x3 storyboard grid image for use as a reference image for AI video.",
  "Character consistency requirements:",
  "- Lock one identity: same face structure, hairstyle, body proportions, age range, and outfit pieces across all panels.",
  "- Do not introduce alternate costumes, hair colors, or accessories unless explicitly requested.",
  "- Keep the character fully visible and readable for downstream video conditioning in all 9 frames.",
  "Layout requirements:",
  "- Exactly 9 panels arranged in a 3x3 grid.",
  "- EACH panel must be strict 9:16 portrait frame ratio (this is mandatory).",
  "- Do NOT make only the entire canvas 9:16 while panels are another ratio.",
  "- Use clear panel boundaries and consistent spacing.",
  "- Cohesive character + scene vibe matching the script below.",
  "- Cinematic keyframe style, clean composition, no text labels.",
] as const;

export function buildCharacterSheetPrompt(input: {
  scriptTitle: string;
  scriptBody: string;
  artDirection?: string;
}): string {
  const extra = input.artDirection?.trim();
  return [
    ...CHARACTER_SHEET_BASE_RULES,
    "",
    `Script title: ${input.scriptTitle}`,
    `Script (for vibe): ${input.scriptBody}`,
    extra ? `Art direction: ${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
