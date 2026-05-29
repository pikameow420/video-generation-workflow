export type ScriptOption = { id: string; title: string; body: string };

export type SavedScript = {
  id: string;
  title: string;
  body: string;
  source: "generated" | "manual" | "uploaded";
  createdAt: string;
};

export type SheetScriptHistoryEntry = {
  id: string;
  selectedScript: { title: string; body: string };
  remainingScripts: Array<{ title: string; body: string }>;
  createdAt: string;
};

export type ReferenceImage = {
  id: string;
  url: string;
  createdAt: string;
  originalName: string;
};

export type { CharacterProfile } from "@/lib/schemas";

export type Step = "topic" | "scripts" | "character" | "sheet" | "video";
export type ScriptMode = "generate" | "manual";
export type SubtitleLanguage = "auto" | "en" | "hi" | "hinglish" | "script";

export type PendingVideoJob = {
  predictionId: string;
  provider: "atlas" | "muapi";
  startedAt: string;
  /** Script title — sent with status polls so the vault row can store a label. */
  title?: string;
};

export type RunCharacterSelection = {
  profileId: string;
  extraReferenceUrls: string[];
};

export type WizardSnapshot = {
  isScriptSidebarOpen: boolean;
  step: Step;
  topic: string;
  tone: string;
  audience: string;
  notes: string;
  basePrompt: string;
  /** Brand voice, words to avoid, sign-off style—injected into script generation. */
  brandKit: string;
  scriptMode: ScriptMode;
  saveManualScript: boolean;
  manualScriptSource: "manual" | "uploaded";
  scripts: ScriptOption[] | null;
  selectedId: string | null;
  scriptEdit: { title: string; body: string };
  artDirection: string;
  /** @deprecated Migrated to runCharacters on restore. */
  selectedCharacterProfileId?: string | null;
  useProfileVoice?: boolean;
  /** @deprecated Migrated to runCharacters on restore. */
  selectedReferenceUrls?: string[];
  /** @deprecated Removed; extras are per-run on runCharacters.extraReferenceUrls. */
  videoExtraReferenceUrls?: string[];
  runCharacters: RunCharacterSelection[];
  /** Extra library images steered into frame sheet generation (beyond character sheets). */
  frameSheetExtraReferenceUrls: string[];
  sheetUrl: string | null;
  sheetSource: "generated" | "uploaded";
  sheetScriptHistory: SheetScriptHistoryEntry[];
  videoUrl: string | null;
  videoMeta: { predictionId: string } | null;
  videoStatus: string;
  subtitleLanguage: SubtitleLanguage;
  /** Playback length from preview video metadata; used when caption language is Script. */
  subtitleVideoDurationSec: number | null;
  subtitleSrt: string;
  subtitleChars: number | null;
  videoHasCaptions: boolean;
  /** In-flight provider job — restored after refresh/sleep so polling can resume. */
  pendingVideoJob: PendingVideoJob | null;
};
