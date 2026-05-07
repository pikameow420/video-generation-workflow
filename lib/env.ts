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
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1.5"),
  OPENAI_IMAGE_SIZE: z.string().default("1024x1536"),
  OPENAI_IMAGE_QUALITY: z.string().default("auto"),
  OPENAI_IMAGE_OUTPUT_FORMAT: z.enum(["png", "jpeg", "webp"]).default("png"),
  SUBTITLE_DEFAULT_LANGUAGE: z.string().default("en"),
  SUBTITLE_MAX_CHARS_PER_LINE: z.coerce.number().int().positive().default(38),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ATLASCLOUD_API_KEY: z.string().optional(),
  ATLASCLOUD_BASE_URL: z.string().url().default("https://api.atlascloud.ai"),
  ATLASCLOUD_SCRIPT_MODEL: z
    .string()
    .default("deepseek-ai/deepseek-v4-pro"),
  ATLASCLOUD_IMAGE_WIDTH: z.coerce.number().int().positive().default(1024),
  ATLASCLOUD_IMAGE_HEIGHT: z.coerce.number().int().positive().default(1792),
  ATLASCLOUD_VIDEO_MODEL: z
    .string()
    .default("bytedance/seedance-2.0-fast/reference-to-video"),
  ATLASCLOUD_VIDEO_DURATION: z.coerce.number().int().positive().default(15),
  ATLASCLOUD_VIDEO_RESOLUTION: z.string().default("720p"),
  ATLASCLOUD_VIDEO_RATIO: z.string().default("9:16"),
  ATLASCLOUD_VIDEO_WIDTH: z.coerce.number().int().positive().default(720),
  ATLASCLOUD_VIDEO_HEIGHT: z.coerce.number().int().positive().default(1280),
  ATLASCLOUD_VIDEO_FPS: z.coerce.number().int().positive().default(24),
  ATLASCLOUD_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  ATLASCLOUD_POLL_MAX_MS: z.coerce.number().int().positive().default(900_000),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

