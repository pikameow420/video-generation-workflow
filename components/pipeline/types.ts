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

export type Step = "topic" | "scripts" | "sheet" | "video";
export type ScriptMode = "generate" | "manual";
export type SubtitleLanguage = "auto" | "en" | "hi" | "hinglish" | "script";

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
  sheetUrl: string | null;
  sheetSource: "generated" | "uploaded";
  selectedReferenceUrls: string[];
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
};
