import { z } from "zod";

export const allowedReferenceImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const maxReferenceImageBytes = 10 * 1024 * 1024;
export const maxScriptBodyChars = 8000;

/** Topic-level inputs collected from the first step of the creator flow. */
export const scriptsRequestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  tone: z.string().optional(),
  audience: z.string().optional(),
  notes: z.string().optional(),
  basePrompt: z.string().optional(),
  /** Voice, banned phrases, CTAs merged into the script system prompt when set. */
  brandKit: z.string().max(8000).optional(),
});

export const scriptOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const scriptsResponseSchema = z.object({
  scripts: z.array(scriptOptionSchema).length(4),
});

export const characterSheetRequestSchema = z.object({
  scriptTitle: z.string().min(1),
  scriptBody: z.string().min(1),
  /** Optional visual guidance for the generated sheet, not a persistent preference. */
  artDirection: z.string().optional(),
  /** Optional uploaded reference image URLs to steer identity/style consistency. */
  referenceImageUrls: z.array(z.string().min(1)).max(9).optional(),
});
export const characterSheetResponseSchema = z.object({
  mimeType: z.string().min(1),
  imageDataUrl: z.string().min(1),
});

export const videoProviderSchema = z.enum(["atlas", "muapi"]);
export type VideoProvider = z.infer<typeof videoProviderSchema>;

export const videoRequestSchema = z.object({
  scriptTitle: z.string().min(1),
  scriptBody: z.string().min(1),
  /** Character sheet image: data URL (data:image/...;base64,...) or HTTPS URL. */
  imageDataUrlOrUrl: z.string().min(1),
  /** When set, overrides `VIDEO_PROVIDER` for this request. */
  provider: videoProviderSchema.optional(),
});
export const videoResponseSchema = z.object({
  predictionId: z.string().min(1),
  videoUrl: z.string().min(1),
});

export const videoConfigResponseSchema = z.object({
  atlasConfigured: z.boolean(),
  muapiConfigured: z.boolean(),
  defaultProvider: videoProviderSchema,
});

export const referenceImageSchema = z.object({
  id: z.string(),
  url: z.string().min(1),
  mimeType: z.string(),
  bytes: z.number().int().positive(),
  originalName: z.string().min(1),
  createdAt: z.string(),
});

export const referenceImageListResponseSchema = z.object({
  items: z.array(referenceImageSchema),
});

export const savedScriptSourceSchema = z.enum([
  "generated",
  "manual",
  "uploaded",
]);

export const savedScriptSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string().min(1).max(maxScriptBodyChars),
  source: savedScriptSourceSchema,
  createdAt: z.string(),
});

export const savedScriptListResponseSchema = z.object({
  items: z.array(savedScriptSchema),
});

export const saveScriptRequestSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z
    .string()
    .trim()
    .min(1, "Script body is required")
    .max(maxScriptBodyChars, `Script body must be <= ${maxScriptBodyChars} characters`),
  source: savedScriptSourceSchema.optional(),
});

export const subtitleCueSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  text: z.string().min(1),
});

export const transcribeSubtitlesRequestSchema = z.object({
  videoUrl: z.string().min(1),
  language: z.string().optional(),
  maxCharsPerLine: z.number().int().positive().optional(),
  /** Required when `language` is `script` (uses this text instead of Whisper). */
  scriptBody: z.string().optional(),
  /** From the video element; improves timing when using script-based captions. */
  videoDurationSec: z.number().positive().finite().optional(),
});

export const transcribeSubtitlesResponseSchema = z.object({
  cues: z.array(subtitleCueSchema),
  srtText: z.string(),
  estimatedChars: z.number().int().nonnegative(),
});

export const burnSubtitlesRequestSchema = z.object({
  videoUrl: z.string().min(1),
  srtText: z.string().min(1),
});
export const burnSubtitlesResponseSchema = z.object({
  captionedVideoUrl: z.string().min(1),
});
