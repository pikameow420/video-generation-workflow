export const FRAME_SEQUENCE_SHEET_BASE_RULES = [
  "Create a single professional 3x3 frame-sequence storyboard grid image for use as a reference image for AI video.",
  "Layout requirements:",
  "- Exactly 9 panels arranged in a 3x3 grid.",
  "- EACH panel must be strict 9:16 portrait frame ratio (this is mandatory).",
  "- Use clear panel boundaries and consistent spacing.",
  "- Cohesive character + scene vibe matching the script below.",
  "- Cinematic keyframe style, clean composition, no text labels.",
] as const;

export type FrameSequenceCharacterAnchor = {
  name: string;
  characterSheetUrl: string;
  referenceImageUrls?: string[];
};

export function buildFrameSequenceSheetPrompt(input: {
  scriptTitle: string;
  scriptBody: string;
  artDirection?: string;
  referenceImageUrls?: string[];
  characterAnchors?: FrameSequenceCharacterAnchor[];
}): string {
  const extra = input.artDirection?.trim();
  const anchors = input.characterAnchors?.filter(Boolean) ?? [];
  const refs = input.referenceImageUrls?.filter(Boolean) ?? [];
  const multi = anchors.length > 1;

  const identityRules = multi
    ? [
        "Multi-character requirements:",
        "- Each named character is a distinct identity; never blend faces, outfits, or body types across characters.",
        "- Distribute the 9 panels by script beats (who speaks, who appears, scene changes)—not by mechanical rotation.",
        "- Use the attached character sheet image(s) as the primary identity lock per character name.",
        ...anchors.map(
          (a, i) =>
            `- Character "${a.name}": lock identity from attached character sheet ${i + 1}.`,
        ),
      ]
    : [
        "Character consistency requirements:",
        "- Lock one identity: same face structure, hairstyle, body proportions, age range, and outfit pieces across all panels.",
        "- Do not introduce alternate costumes, hair colors, or accessories unless explicitly requested.",
        "- Keep the character fully visible and readable for downstream video conditioning in all 9 frames.",
      ];

  return [
    ...FRAME_SEQUENCE_SHEET_BASE_RULES,
    ...identityRules,
    refs.length
      ? "Additional reference image grounding (attached after character sheets):"
      : null,
    ...refs.map(
      (_url, index) =>
        `- Use additional attached reference image ${index + 1} only where it matches an already-locked character identity.`,
    ),
    "",
    `Script title: ${input.scriptTitle}`,
    `Script (for vibe): ${input.scriptBody}`,
    extra ? `Art direction: ${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
