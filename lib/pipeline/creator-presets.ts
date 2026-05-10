import { z } from "zod";

export const CREATOR_PRESETS_STORAGE_KEY = "video-pipeline-creator-presets-v1";
const MAX_PRESETS = 40;
const MAX_PRESET_NAME_LEN = 80;

export const creatorPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_PRESET_NAME_LEN),
  createdAt: z.string(),
  topic: z.string(),
  tone: z.string(),
  audience: z.string(),
  notes: z.string(),
  basePrompt: z.string(),
  artDirection: z.string(),
  brandKit: z.string(),
});

export type CreatorPreset = z.infer<typeof creatorPresetSchema>;

export function loadCreatorPresets(): CreatorPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CREATOR_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const parsedList = z.array(creatorPresetSchema).safeParse(parsed);
    return parsedList.success ? parsedList.data : [];
  } catch {
    return [];
  }
}

function persistCreatorPresets(presets: CreatorPreset[]): void {
  window.localStorage.setItem(
    CREATOR_PRESETS_STORAGE_KEY,
    JSON.stringify(presets.slice(0, MAX_PRESETS)),
  );
}

export function addCreatorPreset(preset: CreatorPreset): CreatorPreset[] {
  const list = loadCreatorPresets();
  const next = [preset, ...list.filter((p) => p.id !== preset.id)].slice(
    0,
    MAX_PRESETS,
  );
  persistCreatorPresets(next);
  return next;
}

export function removeCreatorPreset(id: string): CreatorPreset[] {
  const next = loadCreatorPresets().filter((p) => p.id !== id);
  persistCreatorPresets(next);
  return next;
}
