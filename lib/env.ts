import { z } from "zod";

const envSchema = z.object({
  UPLOAD_BACKEND: z.enum(["local", "blob"]).default("local"),
  LOCAL_UPLOAD_DIR: z.string().default("public/uploads/reference-images"),
  LOCAL_UPLOAD_BASE_PATH: z.string().default("/uploads/reference-images"),
  REFERENCE_IMAGE_INDEX_PATH: z.string().default("data/reference-images.json"),
  LOCAL_CAPTIONED_VIDEO_DIR: z
    .string()
    .default("public/uploads/captioned-videos"),
  LOCAL_CAPTIONED_VIDEO_BASE_PATH: z
    .string()
    .default("/uploads/captioned-videos"),
  CAPTIONED_VIDEO_INDEX_PATH: z
    .string()
    .default("data/captioned-videos.json"),
  SAVED_SCRIPT_INDEX_PATH: z.string().default("data/saved-scripts.json"),
  CHARACTER_PROFILE_INDEX_PATH: z
    .string()
    .default("data/character-profiles.json"),
  LOCAL_CHARACTER_ASSET_DIR: z
    .string()
    .default("public/uploads/character-assets"),
  LOCAL_CHARACTER_ASSET_BASE_PATH: z
    .string()
    .default("/uploads/character-assets"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
  OPENAI_CHARACTER_SHEET_MODEL: z.string().default("gpt-image-2"),
  OPENAI_IMAGE_SIZE: z.string().default("auto"),
  OPENAI_CHARACTER_SHEET_SIZE: z.string().default("auto"),
  OPENAI_IMAGE_QUALITY: z.string().default("auto"),
  OPENAI_IMAGE_OUTPUT_FORMAT: z.enum(["png", "jpeg", "webp"]).default("png"),
  SUBTITLE_DEFAULT_LANGUAGE: z.string().default("en"),
  SUBTITLE_MAX_CHARS_PER_LINE: z.coerce.number().int().positive().default(38),
  SUBTITLE_MAX_SECONDS_PER_CUE: z.coerce.number().positive().default(2.2),
  SUBTITLE_MAX_WORDS_PER_CUE: z.coerce.number().int().positive().default(7),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ATLASCLOUD_API_KEY: z.string().optional(),
  ATLASCLOUD_BASE_URL: z.string().url().default("https://api.atlascloud.ai"),
  ATLASCLOUD_CONSOLE_BASE_URL: z
    .string()
    .url()
    .default("https://console.atlascloud.ai"),
  ATLASCLOUD_CONSOLE_ACCESS_TOKEN: z.string().optional(),
  ATLASCLOUD_CONSOLE_ACCOUNT_ID: z.string().optional(),
  ATLASCLOUD_ASSET_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  ATLASCLOUD_ASSET_POLL_MAX_MS: z.coerce.number().int().positive().default(120000),
  ATLASCLOUD_SCRIPT_MODEL: z
    .string()
    .default("deepseek-ai/deepseek-v4-pro"),
  ATLASCLOUD_IMAGE_WIDTH: z.coerce.number().int().positive().default(1024),
  ATLASCLOUD_IMAGE_HEIGHT: z.coerce.number().int().positive().default(1792),
  ATLASCLOUD_VIDEO_MODEL: z
    .string()
    .default("bytedance/seedance-2.0-fast/reference-to-video"),
  ATLASCLOUD_VIDEO_DURATION: z.coerce.number().int().positive().default(15),
  ATLASCLOUD_VIDEO_RESOLUTION: z.string().default("480p"),
  ATLASCLOUD_VIDEO_RATIO: z.string().default("9:16"),
  ATLASCLOUD_VIDEO_WIDTH: z.coerce.number().int().positive().default(720),
  ATLASCLOUD_VIDEO_HEIGHT: z.coerce.number().int().positive().default(1280),
  ATLASCLOUD_VIDEO_FPS: z.coerce.number().int().positive().default(24),
  ATLASCLOUD_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  ATLASCLOUD_POLL_MAX_MS: z.coerce.number().int().positive().default(900_000),
  VIDEO_PROVIDER: z.enum(["atlas", "muapi"]).default("atlas"),
  MUAPI_API_KEY: z.string().optional(),
  MUAPI_BASE_URL: z.string().url().default("https://api.muapi.ai"),
  MUAPI_VIDEO_ENDPOINT: z
    .string()
    .default("seedance-2-omni-reference-no-video-fast"),
  /** Seedance 2 character sheet (playground sd-2-character). */
  MUAPI_VIDEO_DURATION: z
    .string()
    .optional()
    .transform((raw) => {
      if (raw === undefined || raw.trim() === "") return 15;
      const n = Number(raw.trim());
      if (!Number.isFinite(n)) return 15;
      const i = Math.round(n);
      return Math.min(15, Math.max(4, i));
    })
    .pipe(z.number().int().min(4).max(15)),
  /** VIP Omni endpoint also allows 21:9 and 1:1; default no-video-fast route allows only 16:9, 9:16, 4:3, 3:4. */
  MUAPI_VIDEO_ASPECT_RATIO: z
    .enum(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])
    .default("9:16"),
  MUAPI_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  MUAPI_POLL_MAX_MS: z.coerce.number().int().positive().default(900_000),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_REFERENCE_IMAGES_BUCKET: z.string().min(1).default("reference-images"),
  SUPABASE_PIPELINE_VIDEOS_BUCKET: z.string().min(1).default("pipeline-videos"),
  SUPABASE_CHARACTER_ASSETS_BUCKET: z.string().min(1).default("character-assets"),
  SUPABASE_SIGNED_URL_EXPIRES_SEC: z.coerce.number().int().positive().max(86400).default(3600),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

