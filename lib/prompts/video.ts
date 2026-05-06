export const VIDEO_BASE_RULES = [
  "Create a ~15 second vertical-ready social video with native audio, using the provided image as the first frame.",
  "Keep motion coherent with the character sheet; natural pacing; clear focal subject.",
  "Character consistency lock:",
  "- Keep the same exact character identity from the reference image (face, hair, body proportions, outfit, color palette).",
  "- No costume swaps, no new accessories, no age/gender changes, and no duplicate characters.",
  "- Preserve style and visual identity across the full clip.",
] as const;

export function buildVideoPrompt(scriptTitle: string, scriptBody: string): string {
  return [
    ...VIDEO_BASE_RULES,
    "",
    `Title: ${scriptTitle}`,
    "Narration / voiceover script:",
    scriptBody,
  ].join("\n");
}
