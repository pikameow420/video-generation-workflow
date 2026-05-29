import type { VideoAudioSlot, VideoImageSlot } from "@/lib/pipeline/video-image-slots";

export const VIDEO_BASE_RULES = [
  "Create a short vertical-ready social video with native audio.",
  "Keep motion coherent with the Video Sheet; natural pacing.",
  "Framing & focus: center speaking characters visually; keep faces sharp and readable when on camera.",
  "Lipsync: when a character's speaking face is on camera, lip and jaw movement should match the narration.",
  "Character consistency lock:",
  "- Preserve each distinct character identity from the numbered reference slots.",
  "- No gender changes or unintended duplicate characters.",
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
  "Keep motion coherent with the Video Sheet; natural pacing.",
  "Framing & focus: center speaking characters visually; keep faces sharp and readable when on camera.",
  "Lipsync: when a character's speaking face is on camera, lip and jaw movement should match the narration.",
  "Character consistency lock:",
  "- Preserve each distinct character identity from @image slots and @character references.",
  "- No gender changes or unintended duplicate characters.",
] as const;

function buildImageSlotLines(imageSlots: VideoImageSlot[]): string[] {
  const lines: string[] = [];
  let imageIndex = 0;
  for (const slot of imageSlots) {
    imageIndex += 1;
    if (slot.kind === "frameSheet") {
      lines.push(
        `Condition @image${imageIndex} as the frame sequence storyboard (scene layout and panel flow—not a single face paste).`,
      );
    } else if (slot.kind === "characterSheet") {
      lines.push(
        `Use @image${imageIndex} as the identity character sheet for Character "${slot.name}".`,
      );
    } else {
      lines.push(`Use @image${imageIndex} as an additional visual anchor.`);
    }
  }
  return lines;
}

function buildCharacterIdLines(
  characters: { name: string; requestId: string }[],
): string[] {
  return characters.map(
    (c) =>
      `Reference @character:${c.requestId} for Character "${c.name}" identity (in addition to numbered @image slots).`,
  );
}

function buildAudioSlotLines(audioSlots: VideoAudioSlot[], scriptBody: string): string[] {
  if (!audioSlots.length || audioSlots.length > 3) return [];
  if (/@audio\d/.test(scriptBody)) return [];

  return audioSlots.map(
    (slot, i) =>
      `Use @audio${i + 1} as the voice for Character "${slot.name}".`,
  );
}

export function buildMuapiOmniReferencePrompt(
  scriptTitle: string,
  scriptBody: string,
  imageSlots: VideoImageSlot[],
  audioSlots: VideoAudioSlot[] = [],
  muapiCharacterRequestIds: { name: string; requestId: string }[] = [],
): string {
  const multiChar =
    imageSlots.filter((s) => s.kind === "characterSheet").length > 1 ||
    muapiCharacterRequestIds.length > 1;

  const imageLines = buildImageSlotLines(imageSlots);
  const characterIdLines = buildCharacterIdLines(muapiCharacterRequestIds);
  const audioLines = buildAudioSlotLines(audioSlots, scriptBody);

  const multiLines = multiChar
    ? [
        "Multi-character mode:",
        "- Distinct identities; who appears on camera follows the script.",
        "- Do not merge or swap faces/outfits between characters.",
      ]
    : [];

  const headerParts = [
    ...MUAPI_OMNI_RULES,
    ...multiLines,
    ...imageLines,
    ...characterIdLines,
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
  const clipped =
    budget > 0 ? scriptBody.slice(0, budget).trimEnd() + note : scriptBody.slice(0, MUAPI_PROMPT_MAX_CHARS);
  return `${header}\n${clipped}`;
}
