export const VIDEO_BASE_RULES = [
  "Create a short vertical-ready social video with native audio.",
  "Keep motion coherent with the frame sequence sheet; natural pacing.",
  "Framing & focus: center the hero character visually; keep them sharp and clearly in frame when visible (readable face and outfit—not soft or lost in the background).",
  "Lipsync: when the character's speaking face is on camera, lip and jaw movement should believably match the narration's timing and words (avoid silent mouth during speech or mouthing mismatches).",
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

const MUAPI_PROMPT_MAX_CHARS = 4000;

const MUAPI_OMNI_RULES = [
  "Create a short vertical-ready social video with native audio.",
  "Keep motion coherent with the frame sequence sheet; natural pacing.",
  "Framing & focus: center the hero character visually; keep them sharp and clearly in frame when visible (readable face and outfit—not soft or lost in the background).",
  "Lipsync: when the character's speaking face is on camera, lip and jaw movement should believably match the narration's timing and words (avoid silent mouth during speech or mouthing mismatches).",
  "Character consistency lock:",
  "- Keep the same exact character identity from the numbered reference slots @image1, @image2, … (face, hair, body proportions, outfit, color palette).",
  "- No gender changes or duplicate characters.",
  "- Preserve style and visual identity across the full clip.",
] as const;

/** Prompt for MuAPI Seedance Omni Reference: uses @image1… and optional @audio1… (max 4000 chars). */
export function buildMuapiOmniReferencePrompt(
  scriptTitle: string,
  scriptBody: string,
  imageCount: number,
  audioCount = 0,
): string {
  const refLine =
    imageCount > 0
      ? `Condition on every reference image: @image1 through @image${imageCount} (same order as images_list).`
      : null;

  const audioLines: string[] = [];
  if (audioCount > 0 && audioCount <= 3) {
    const hasManualAudioRef = /@audio\d/.test(scriptBody);
    if (!hasManualAudioRef) {
      if (audioCount === 1) {
        audioLines.push("Use @audio1 as the voice reference.");
      } else if (audioCount === 2) {
        audioLines.push(
          "Use @audio1 as the voice reference. Use @audio2 as an additional audio reference where appropriate.",
        );
      } else {
        audioLines.push(
          "Use @audio1 as the voice reference. Use @audio2 and @audio3 as additional audio references where appropriate.",
        );
      }
    }
  }

  const headerParts = [
    ...MUAPI_OMNI_RULES,
    refLine,
    ...audioLines,
    "",
    `Title: ${scriptTitle}`,
    "Narration / voiceover script:",
  ];
  const header = headerParts.filter(Boolean).join("\n");
  const text = `${header}\n${scriptBody}`;
  if (text.length <= MUAPI_PROMPT_MAX_CHARS) return text;

  const note = "\n...[script truncated for API limit]";
  const budget = MUAPI_PROMPT_MAX_CHARS - header.length - note.length;
  const clipped = budget > 0 ? scriptBody.slice(0, budget).trimEnd() + note : scriptBody.slice(0, MUAPI_PROMPT_MAX_CHARS);
  return `${header}\n${clipped}`;
}
