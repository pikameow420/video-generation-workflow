/** Shared wizard constants and helpers. */

import type {
  ScriptMode,
  ScriptOption,
  Step,
  WizardSnapshot,
} from "@/components/pipeline/types";
import type { VideoProvider } from "@/lib/schemas";

export const WIZARD_STORAGE_KEY = "video-pipeline-wizard-state-v1";
export const MAX_MANUAL_SCRIPT_FILE_BYTES = 256 * 1024;
export const MAX_REFERENCE_IMAGES = 9;
export const VIDEO_PROVIDER_STORAGE_KEY = "pipeline-video-provider";

/** Default wizard state for a fresh pipeline run. */
export function createEmptyWizardSnapshot(): WizardSnapshot {
  return {
    isScriptSidebarOpen: true,
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
    sheetUrl: null,
    sheetSource: "generated",
    selectedReferenceUrls: [],
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
  { id: "sheet", label: "Character Sheet", shortLabel: "Sheet" },
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
  const scriptsPhaseDone =
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

  const sheetState: WizardStepUiState = sheetUrl
    ? {
        accessible: true,
        complete: sheetPhaseDone,
      }
    : {
        accessible: false,
        complete: false,
        disabledReason: "Generate or upload a character sheet first",
      };

  const videoState: WizardStepUiState = sheetUrl
    ? {
        accessible: true,
        complete: videoPhaseDone,
      }
    : {
        accessible: false,
        complete: false,
        disabledReason: "Complete the character sheet step first",
      };

  return {
    topic: topicState,
    scripts: scriptsState,
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
