/** Shared wizard constants and helpers. */

import type {
  RunCharacterSelection,
  ScriptMode,
  ScriptOption,
  SheetScriptHistoryEntry,
  Step,
  WizardSnapshot,
} from "@/components/pipeline/types";
import type { CharacterProfile, VideoProvider } from "@/lib/schemas";

export const WIZARD_STORAGE_KEY = "video-pipeline-wizard-state-v1";
export const MAX_MANUAL_SCRIPT_FILE_BYTES = 256 * 1024;
export const MAX_REFERENCE_IMAGES = 9;
export const SHEET_SCRIPT_HISTORY_MAX = 20;
export const VIDEO_PROVIDER_STORAGE_KEY = "pipeline-video-provider";

export function remainingScriptsForBatch(
  scripts: ScriptOption[] | null,
  title: string,
  body: string,
): Array<{ title: string; body: string }> {
  const selectedKey = `${title}::${body}`;
  if (!scripts?.length) return [];
  return scripts
    .filter((item) => `${item.title.trim()}::${item.body.trim()}` !== selectedKey)
    .map((item) => ({ title: item.title, body: item.body }));
}

export function sheetScriptHistoryContains(
  history: SheetScriptHistoryEntry[],
  title: string,
  body: string,
): boolean {
  const t = title.trim();
  const b = body.trim();
  return history.some(
    (item) =>
      item.selectedScript.title.trim() === t && item.selectedScript.body.trim() === b,
  );
}

export function buildSheetScriptHistoryEntry(input: {
  title: string;
  body: string;
  remainingScripts?: Array<{ title: string; body: string }>;
}): SheetScriptHistoryEntry {
  const title = input.title.trim() || "Untitled Script";
  const body = input.body.trim();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    selectedScript: { title, body },
    remainingScripts: input.remainingScripts ?? [],
    createdAt: new Date().toISOString(),
  };
}

export function upsertSheetScriptHistoryEntry(
  prev: SheetScriptHistoryEntry[],
  input: {
    title: string;
    body: string;
    scripts?: ScriptOption[] | null;
  },
): SheetScriptHistoryEntry[] {
  const title = input.title.trim() || "Untitled Script";
  const body = input.body.trim();
  if (!body) return prev;

  const entry = buildSheetScriptHistoryEntry({
    title,
    body,
    remainingScripts: remainingScriptsForBatch(input.scripts ?? null, title, body),
  });
  const deduped = prev.filter(
    (item) =>
      item.selectedScript.title.trim() !== title ||
      item.selectedScript.body.trim() !== body,
  );
  return [entry, ...deduped].slice(0, SHEET_SCRIPT_HISTORY_MAX);
}

/** Default wizard state for a fresh pipeline run. */
export function createEmptyWizardSnapshot(): WizardSnapshot {
  return {
    isScriptSidebarOpen: false,
    step: "topic",
    topic: "",
    tone: "",
    audience: "",
    notes: "",
    basePrompt: "",
    brandKit: "",
    scriptMode: "generate",
    saveManualScript: true,
    manualScriptSource: "manual",
    scripts: null,
    selectedId: null,
    scriptEdit: { title: "", body: "" },
    artDirection: "",
    runCharacters: [],
    frameSheetExtraReferenceUrls: [],
    sheetUrl: null,
    sheetSource: "generated",
    sheetScriptHistory: [],
    videoUrl: null,
    videoMeta: null,
    videoStatus: "",
    subtitleLanguage: "auto",
    subtitleVideoDurationSec: null,
    subtitleSrt: "",
    subtitleChars: null,
    videoHasCaptions: false,
    pendingVideoJob: null,
  };
}

export type WizardStepMeta = {
  id: Step;
  label: string;
  shortLabel: string;
};

export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  { id: "topic", label: "Pick Topic", shortLabel: "Topic" },
  { id: "scripts", label: "Choose Script", shortLabel: "Scripts" },
  { id: "character", label: "Character Profile", shortLabel: "Character" },
  { id: "sheet", label: "Video Sheet", shortLabel: "Sheet" },
  { id: "video", label: "Generate Video", shortLabel: "Video" },
] as const;

export type WizardStepUiState = {
  accessible: boolean;
  complete: boolean;
  disabledReason?: string;
};

export type GetWizardStepStatesArgs = {
  currentStep: Step;
  scriptMode: ScriptMode;
  topic: string;
  scriptEdit: { title: string; body: string };
  scripts: ScriptOption[] | null;
  sheetUrl: string | null;
  videoUrl: string | null;
};

/** Whether the user can open the Scripts step (prerequisite navigation). */
export function hasScriptsPrerequisites(args: {
  scriptMode: ScriptMode;
  topic: string;
  scriptEdit: { body: string };
  scripts: ScriptOption[] | null;
}): boolean {
  const { scriptMode, topic, scriptEdit, scripts } = args;
  if (scripts !== null) return true;
  if (scriptMode === "generate") return topic.trim().length > 0;
  return scriptEdit.body.trim().length > 0;
}

export function getWizardStepStates(
  args: GetWizardStepStatesArgs,
): Record<Step, WizardStepUiState> {
  const {
    currentStep,
    scriptMode,
    topic,
    scriptEdit,
    scripts,
    sheetUrl,
    videoUrl,
  } = args;

  const scriptsReachable = hasScriptsPrerequisites({
    scriptMode,
    topic,
    scriptEdit,
    scripts,
  });

  const hasScriptBody = scriptEdit.body.trim().length > 0;
  const characterReached =
    currentStep === "character" ||
    currentStep === "sheet" ||
    currentStep === "video";
  const scriptsPhaseDone = characterReached && hasScriptBody;
  const characterPhaseDone =
    (currentStep === "sheet" || currentStep === "video") && hasScriptBody;
  const sheetPhaseDone = currentStep === "video" && Boolean(sheetUrl);
  const videoPhaseDone = Boolean(videoUrl);

  const topicState: WizardStepUiState = {
    accessible: true,
    complete: scriptsReachable,
  };

  const scriptsState: WizardStepUiState = scriptsReachable
    ? {
        accessible: true,
        complete: scriptsPhaseDone,
      }
    : {
        accessible: false,
        complete: false,
        disabledReason: "Enter a topic or script first",
      };

  const characterState: WizardStepUiState = hasScriptBody
    ? {
        accessible: true,
        complete: characterPhaseDone,
      }
    : {
        accessible: false,
        complete: false,
        disabledReason: "Choose a script first",
      };

  const sheetState: WizardStepUiState = sheetUrl
    ? {
        accessible: true,
        complete: sheetPhaseDone,
      }
    : {
        accessible: false,
        complete: false,
        disabledReason: "Generate or reuse a Video Sheet first",
      };

  const videoState: WizardStepUiState = sheetUrl
    ? {
        accessible: true,
        complete: videoPhaseDone,
      }
    : {
        accessible: false,
        complete: false,
        disabledReason: "Complete the Video Sheet step first",
      };

  return {
    topic: topicState,
    scripts: scriptsState,
    character: characterState,
    sheet: sheetState,
    video: videoState,
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function readStoredVideoProvider(): VideoProvider | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(VIDEO_PROVIDER_STORAGE_KEY);
  return raw === "atlas" || raw === "muapi" ? raw : null;
}

export function normalizeReferenceUrl(url: string): string {
  return url.trim();
}

export function dedupeReferenceUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const raw of urls) {
    const normalized = normalizeReferenceUrl(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length >= MAX_REFERENCE_IMAGES) break;
  }
  return deduped;
}

export function migrateWizardSnapshot(
  loaded: Partial<WizardSnapshot>,
): Partial<WizardSnapshot> {
  const next = { ...loaded };
  if (!next.runCharacters?.length && next.selectedCharacterProfileId) {
    next.runCharacters = [
      {
        profileId: next.selectedCharacterProfileId,
        extraReferenceUrls: [],
      },
    ];
  }
  if (!next.runCharacters) {
    next.runCharacters = [];
  }
  if (!next.frameSheetExtraReferenceUrls) {
    next.frameSheetExtraReferenceUrls = [];
  }
  if (!next.sheetScriptHistory) {
    next.sheetScriptHistory = [];
  }
  delete (next as { pipelineRunId?: unknown }).pipelineRunId;
  delete next.videoExtraReferenceUrls;
  delete next.selectedCharacterProfileId;
  delete next.selectedReferenceUrls;
  delete next.useProfileVoice;
  return next;
}

export function toggleRunCharacter(
  current: RunCharacterSelection[],
  profileId: string,
  _profile?: CharacterProfile,
): RunCharacterSelection[] {
  const exists = current.find((c) => c.profileId === profileId);
  if (exists) {
    return current.filter((c) => c.profileId !== profileId);
  }
  return [
    ...current,
    {
      profileId,
      extraReferenceUrls: [],
    },
  ];
}

/** How many extra library refs can be attached for frame sheet (9 OpenAI slots minus character sheets). */
export function maxFrameSheetExtraReferences(characterSheetCount: number): number {
  return Math.max(0, MAX_REFERENCE_IMAGES - characterSheetCount);
}

export function buildCharacterAnchorsForSheet(
  runCharacters: RunCharacterSelection[],
  profiles: CharacterProfile[],
) {
  return runCharacters
    .map((run) => {
      const profile = profiles.find((p) => p.id === run.profileId);
      if (!profile?.muapiCharacterSheetUrl) return null;
      return {
        name: profile.name,
        characterSheetUrl: profile.muapiCharacterSheetUrl,
        referenceImageUrls: run.extraReferenceUrls.length
          ? dedupeReferenceUrls(run.extraReferenceUrls)
          : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/** Download a profile voice sample URL and return a normalized data URL. */
export async function fetchVoiceSampleDataUrl(voice: {
  url: string;
  mimeType: string;
}): Promise<string> {
  const res = await fetch(voice.url);
  if (!res.ok) {
    throw new Error("Could not download the profile's voice sample");
  }
  const blob = await res.blob();
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the profile's voice sample"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the profile's voice sample"));
    reader.readAsDataURL(blob);
  });
  const base64 = rawDataUrl.slice(rawDataUrl.indexOf(",") + 1);
  return `data:${voice.mimeType};base64,${base64}`;
}
