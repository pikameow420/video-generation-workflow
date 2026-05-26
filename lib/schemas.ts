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

export const frameSequenceSheetRequestSchema = z.object({
  scriptTitle: z.string().min(1),
  scriptBody: z.string().min(1),
  /** Optional visual guidance for the generated sheet, not a persistent preference. */
  artDirection: z.string().optional(),
  /** Optional uploaded reference image URLs to steer identity/style consistency. */
  referenceImageUrls: z.array(z.string().min(1)).max(9).optional(),
});
export const frameSequenceSheetResponseSchema = z.object({
  mimeType: z.string().min(1),
  imageDataUrl: z.string().min(1),
});

export const videoProviderSchema = z.enum(["atlas", "muapi"]);
export type VideoProvider = z.infer<typeof videoProviderSchema>;

export const maxMuapiAudioFiles = 3;
export const maxMuapiAudioBytesPerFile = 12 * 1024 * 1024;

export const videoRequestSchema = z.object({
  scriptTitle: z.string().min(1),
  scriptBody: z.string().min(1),
  /** Character sheet image: data URL (data:image/...;base64,...) or HTTPS URL. */
  imageDataUrlOrUrl: z.string().min(1),
  /** When set, overrides `VIDEO_PROVIDER` for this request. */
  provider: videoProviderSchema.optional(),
  /** MuAPI only: up to 3 audio data URLs (MP3/WAV) for Omni Reference `audio_files`; slots @audio1…@audio3. */
  audioDataUrls: z
    .array(z.string().min(1))
    .max(maxMuapiAudioFiles)
    .optional(),
});
export type VideoRequest = z.infer<typeof videoRequestSchema>;
/** Returned immediately after POST /api/video starts a provider job. */
export const videoStartResponseSchema = z.object({
  predictionId: z.string().min(1),
  status: z.literal("processing"),
  provider: videoProviderSchema,
});

export const videoStatusQuerySchema = z.object({
  predictionId: z.string().min(1),
  provider: videoProviderSchema,
  /** Script title for library display — passed from client poll while job runs. */
  title: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((s) => {
      if (s == null || s === "") return undefined;
      const t = s.trim().slice(0, 200);
      return t || undefined;
    }),
});

export const videoStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("processing"),
    predictionId: z.string().min(1),
  }),
  z.object({
    status: z.literal("completed"),
    predictionId: z.string().min(1),
    videoUrl: z.string().min(1),
    hasCaptions: z.boolean(),
  }),
  z.object({
    status: z.literal("failed"),
    predictionId: z.string().min(1),
    error: z.string().min(1),
  }),
]);

/** @deprecated Use videoStartResponseSchema + videoStatusResponseSchema */
export const videoResponseSchema = z.object({
  predictionId: z.string().min(1),
  videoUrl: z.string().min(1),
});

export const videoConfigResponseSchema = z.object({
  atlasConfigured: z.boolean(),
  muapiConfigured: z.boolean(),
  defaultProvider: videoProviderSchema,
});

export const videoQuotaResponseSchema = z.object({
  exempt: z.boolean(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive().nullable(),
  canStart: z.boolean(),
});
export type VideoQuotaResponse = z.infer<typeof videoQuotaResponseSchema>;

/** One stored pipeline output (Supabase Storage + signed playback URL). */
export const pipelineVideoListItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  hasCaptions: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string().nullable(),
});

export const pipelineVideoListResponseSchema = z.object({
  items: z.array(pipelineVideoListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  persistence: z.enum(["supabase", "none"]),
});

export const pipelineVideoLookupResponseSchema = z.object({
  found: z.boolean(),
  id: z.string().optional(),
  hasCaptions: z.boolean().optional(),
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

export const allowedCharacterVoiceMimeTypes = [
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
] as const;
export const maxCharacterVoiceBytes = maxMuapiAudioBytesPerFile;
export const maxCharacterProfileNameChars = 80;
export const maxCharacterProfileArtDirectionChars = 2000;

/** Anchor reference resolved to a fresh URL at list time (signed URLs expire). */
export const characterProfileReferenceSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  originalName: z.string(),
});

export type CharacterProfileReference = z.infer<typeof characterProfileReferenceSchema>;

export const characterProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  artDirection: z.string(),
  referenceImages: z.array(characterProfileReferenceSchema),
  voiceSample: z
    .object({
      url: z.string().min(1),
      mimeType: z.string().min(1),
      originalName: z.string(),
    })
    .nullable(),
  /** Last saved frame-sequence-sheet for this profile, reusable across runs. */
  sheetUrl: z.string().min(1).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CharacterProfile = z.infer<typeof characterProfileSchema>;

export const characterProfileListResponseSchema = z.object({
  items: z.array(characterProfileSchema),
});

/** JSON `payload` field of the multipart create request (voice file travels separately). */
export const createCharacterProfileFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required")
    .max(maxCharacterProfileNameChars),
  artDirection: z
    .string()
    .trim()
    .max(maxCharacterProfileArtDirectionChars)
    .optional()
    .default(""),
  referenceImageIds: z
    .array(z.string().min(1))
    .min(1, "At least one anchor reference image is required")
    .max(9),
});

/** JSON `payload` field of the multipart update request. Voice file travels separately;
 * `removeVoiceSample` clears the stored sample when no replacement file is sent. */
export const updateCharacterProfileFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required")
    .max(maxCharacterProfileNameChars),
  artDirection: z
    .string()
    .trim()
    .max(maxCharacterProfileArtDirectionChars)
    .optional()
    .default(""),
  referenceImageIds: z
    .array(z.string().min(1))
    .min(1, "At least one anchor reference image is required")
    .max(9),
  removeVoiceSample: z.boolean().optional().default(false),
});

export const saveCharacterProfileSheetRequestSchema = z.object({
  imageDataUrl: z
    .string()
    .min(1)
    .regex(/^data:image\/(png|jpeg|webp);base64,/, {
      message: "imageDataUrl must be a base64 image data URL",
    }),
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
  predictionId: z.string().min(1),
  title: z.string().max(200).optional(),
});
export const burnSubtitlesResponseSchema = z.object({
  videoUrl: z.string().min(1),
  hasCaptions: z.literal(true),
});
