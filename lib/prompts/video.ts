export const VIDEO_BASE_RULES = [
  "Create a second vertical-ready social video with native audio",
  "Keep motion coherent with the character sheet; natural pacing; clear focal subject.",
  "Character consistency lock:",
  "- Keep the same exact character identity from the reference image (face, hair, body proportions, outfit, color palette).",
  "- No gender changes or duplicate characters.",
  "- Preserve style and visual identity across the full clip.",
] as const;

export function buildVideoPrompt(
  scriptTitle: string,
  scriptBody: string,
  referenceImageUrls: string[] = [],
): string {
  return [
    ...VIDEO_BASE_RULES,
    referenceImageUrls.length
      ? "Use ALL provided reference assets in conditioning."
      : null,
    ...referenceImageUrls.map(
      (url, index) => `- Reference ${index + 1}: ${url}`,
    ),
    "",
    `Title: ${scriptTitle}`,
    "Narration / voiceover script:",
    scriptBody,
  ]
    .filter(Boolean)
    .join("\n");
}
