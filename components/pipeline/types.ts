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

export type WizardSnapshot = {
  isScriptSidebarOpen: boolean;
  step: Step;
  topic: string;
  tone: string;
  audience: string;
  notes: string;
  basePrompt: string;
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
  subtitleSrt: string;
  subtitleChars: number | null;
  captionedVideoUrl: string | null;
};
