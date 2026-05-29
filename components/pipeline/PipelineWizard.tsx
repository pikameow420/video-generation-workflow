"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FreeVideoModal,
  hasSeenFreeVideoNotice,
  markFreeVideoNoticeSeen,
} from "@/components/auth/FreeVideoModal";
import { ScriptHistorySidebar } from "@/components/pipeline/ScriptHistorySidebar";
import type {
  PendingVideoJob,
  ReferenceImage,
  SavedScript,
  ScriptMode,
  ScriptOption,
  SheetScriptHistoryEntry,
  Step,
  SubtitleLanguage,
  WizardSnapshot,
} from "@/components/pipeline/types";
import { PipelineStepper } from "@/components/pipeline/PipelineStepper";
import { WizardSummaryCard } from "@/components/pipeline/WizardSummaryCard";
import { CharacterStep } from "@/components/pipeline/steps/CharacterStep";
import { ScriptsStep } from "@/components/pipeline/steps/ScriptsStep";
import { SheetStep } from "@/components/pipeline/steps/SheetStep";
import { TopicStep } from "@/components/pipeline/steps/TopicStep";
import { VideoStep } from "@/components/pipeline/steps/VideoStep";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  createEmptyWizardSnapshot,
  getWizardStepStates,
  sheetScriptHistoryContains,
  upsertSheetScriptHistoryEntry,
  WIZARD_STORAGE_KEY,
} from "@/lib/pipeline/wizard-utils";
import { useApiAction } from "@/hooks/useApiAction";
import { useConfirmAlertDialog } from "@/hooks/useConfirmAlertDialog";
import { useCreatorPresets } from "@/hooks/useCreatorPresets";
import { useWizardCharacterStep } from "@/hooks/useWizardCharacterStep";
import { useWizardScriptsFlow } from "@/hooks/useWizardScriptsFlow";
import { usePipelineLibraryApi } from "@/hooks/usePipelineLibraryApi";
import { usePipelineVideoProvider } from "@/hooks/usePipelineVideoProvider";
import { useMuapiAudioAttachments } from "@/hooks/useMuapiAudioAttachments";
import { useWizardSubtitleActions } from "@/hooks/useWizardSubtitleActions";
import { useWizardSheetVideoGeneration } from "@/hooks/useWizardSheetVideoGeneration";
import { useWizardPendingVideoJob } from "@/hooks/useWizardPendingVideoJob";
import { usePipelineVideoStored } from "@/hooks/usePipelineVideoStored";
import { useWizardLocalStorage } from "@/hooks/useWizardLocalStorage";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useVideoQuota } from "@/hooks/useVideoQuota";
import { toast } from "sonner";

export function PipelineWizard() {
  const [isScriptSidebarOpen, setIsScriptSidebarOpen] = useState(true);
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [brandKit, setBrandKit] = useState("");
  const [scriptMode, setScriptMode] = useState<ScriptMode>("generate");
  const [saveManualScript, setSaveManualScript] = useState(true);
  const [manualScriptSource, setManualScriptSource] = useState<
    "manual" | "uploaded"
  >("manual");
  const [scripts, setScripts] = useState<ScriptOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scriptEdit, setScriptEdit] = useState({ title: "", body: "" });
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
  const [loadingSavedScripts, setLoadingSavedScripts] = useState(false);
  const [savedScriptsLoaded, setSavedScriptsLoaded] = useState(false);
  const [sheetScriptHistory, setSheetScriptHistory] = useState<
    SheetScriptHistoryEntry[]
  >([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null,
  );
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetSource, setSheetSource] = useState<"generated" | "uploaded">(
    "generated",
  );
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [loadingReferenceImages, setLoadingReferenceImages] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ predictionId: string } | null>(
    null,
  );
  const [videoStatus, setVideoStatus] = useState("");
  const [subtitleLanguage, setSubtitleLanguage] =
    useState<SubtitleLanguage>("auto");
  const [subtitleSrt, setSubtitleSrt] = useState("");
  const [subtitleChars, setSubtitleChars] = useState<number | null>(null);
  const [subtitleVideoDurationSec, setSubtitleVideoDurationSec] = useState<
    number | null
  >(null);
  const [videoHasCaptions, setVideoHasCaptions] = useState(false);
  const [pendingVideoJob, setPendingVideoJob] = useState<PendingVideoJob | null>(
    null,
  );
  /** True only during `/api/video` — SheetStep uses this instead of shared `busy` for the primary CTA label. */
  const [videoGenerationBusy, setVideoGenerationBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [frameSheetGenerationBusy, setFrameSheetGenerationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freeVideoNoticeOpen, setFreeVideoNoticeOpen] = useState(false);
  const [freeVideoLimitOpen, setFreeVideoLimitOpen] = useState(false);
  const pendingStartAfterNotice = useRef(false);

  useAuthGuard(useCallback(() => {
    if (pendingVideoJob !== null) {
      setPendingVideoJob(null);
      setVideoStatus("");
      setVideoGenerationBusy(false);
      toast.info("User changed - video generation job cleared");
    }
  }, [pendingVideoJob]));

  const {
    muapiAudioDataUrls,
    muapiAudioFileNames,
    clearMuapiAudio,
    onMuapiAudioFilesChange,
  } = useMuapiAudioAttachments();

  const {
    videoProvider,
    persistVideoProvider,
    videoProviderEnv,
    videoBackendReady,
  } = usePipelineVideoProvider(clearMuapiAudio);

  const videoQuota = useVideoQuota(step === "sheet" || step === "video");
  const canStartVideoWithQuota =
    videoBackendReady && !videoQuota.loading && videoQuota.canStart;

  const runApiAction = useApiAction({
    onError: (message) => {
      setError(message);
      toast.error(message);
    },
    setBusy,
    clearError: () => setError(null),
  });

  const { confirm, dialog: confirmDialog } = useConfirmAlertDialog();

  const {
    loadReferenceImages,
    loadSavedScripts,
    upsertReferenceImage,
    removeReferenceImage,
  } = usePipelineLibraryApi({
    setReferenceImages,
    setLoadingReferenceImages,
    setSavedScripts,
    setSavedScriptsLoaded,
    setLoadingSavedScripts,
    setError,
  });

  const { generateSubtitles, burnSubtitles } = useWizardSubtitleActions({
    runApiAction,
    videoUrl,
    subtitleLanguage,
    scriptBody: scriptEdit.body,
    scriptTitle: scriptEdit.title,
    subtitleVideoDurationSec,
    subtitleSrt,
    videoMeta,
    setSubtitleSrt,
    setSubtitleChars,
    setVideoHasCaptions,
    setVideoUrl,
  });

  const videoStoredInLibrary = usePipelineVideoStored(
    videoMeta?.predictionId,
    Boolean(videoUrl && videoMeta?.predictionId),
    videoHasCaptions ? "captioned" : "raw",
  );

  const selectedScript = scripts?.find((script) => script.id === selectedId) ?? null;
  const currentBatchPrimaryScript = selectedScript ?? scripts?.[0] ?? null;
  const activeScript = useMemo(() => {
    const body = scriptEdit.body.trim();
    if (!body) return null;
    return {
      title: scriptEdit.title.trim() || "Untitled Script",
      body,
    };
  }, [scriptEdit.body, scriptEdit.title]);

  const currentBatchRemainingScripts =
    scripts?.filter((script) => script.id !== currentBatchPrimaryScript?.id) ??
    [];
  const isScriptsDone =
    step === "character" || step === "sheet" || step === "video";
  const isCharacterDone = step === "sheet" || step === "video";
  const isSheetDone = step === "video";

  /**
   * The sheet and video are derived from the script + character inputs. Whenever
   * those inputs change, the previously generated outputs are stale: drop them and
   * pull the user back to the Character step if they were sitting on an output step.
   */
  const invalidateGeneratedOutputs = useCallback(() => {
    setSheetUrl(null);
    setSheetSource("generated");
    setVideoUrl(null);
    setVideoMeta(null);
    setVideoStatus("");
    setVideoHasCaptions(false);
    setPendingVideoJob(null);
    setVideoGenerationBusy(false);
    setSubtitleSrt("");
    setSubtitleChars(null);
    setSubtitleVideoDurationSec(null);
    setStep((prev) => (prev === "sheet" || prev === "video" ? "character" : prev));
  }, []);

  const scriptsFlow = useWizardScriptsFlow({
    runApiAction,
    invalidateGeneratedOutputs,
    setError,
    setStep,
    topic,
    tone,
    audience,
    notes,
    basePrompt,
    brandKit,
    scriptMode,
    saveManualScript,
    manualScriptSource,
    scripts,
    selectedId,
    scriptEdit,
    savedScripts,
    setScriptMode,
    setScripts,
    setSelectedId,
    setScriptEdit,
    setManualScriptSource,
    setSavedScripts,
    setSavedScriptsLoaded,
    setSheetScriptHistory,
    setExpandedHistoryId,
    loadReferenceImages,
    loadSavedScripts,
  });

  const {
    recordSheetScriptHistory,
    onPickScript,
    onScriptEditChange,
    maybeSaveGeneratedScript,
    generateScripts,
    continueWithManualScript,
    onUploadScriptFile,
    createNewScript,
    applyScriptFromHistory,
    continueToCharacterStep,
  } = scriptsFlow;

  const recordSheetScriptHistoryWhenReady = useCallback(() => {
    if (!sheetUrl?.trim()) return;
    recordSheetScriptHistory();
  }, [recordSheetScriptHistory, sheetUrl]);

  useWizardPendingVideoJob({
    pendingVideoJob,
    setVideoUrl,
    setVideoMeta,
    setVideoHasCaptions,
    setPendingVideoJob,
    setVideoStatus,
    setVideoGenerationBusy,
    setStep,
    setError,
  });

  const clearVideoOutputs = useCallback(() => {
    setVideoUrl(null);
    setVideoMeta(null);
    setVideoHasCaptions(false);
    setSubtitleSrt("");
    setSubtitleChars(null);
    setSubtitleVideoDurationSec(null);
  }, []);

  const advanceToSheet = useCallback(
    (args: {
      sheetUrl: string;
      sheetSource: "generated" | "uploaded";
      trackHistory?: boolean;
    }) => {
      clearVideoOutputs();
      setSheetUrl(args.sheetUrl);
      setSheetSource(args.sheetSource);
      if (args.trackHistory) recordSheetScriptHistory();
      setStep("sheet");
    },
    [clearVideoOutputs, recordSheetScriptHistory],
  );

  const character = useWizardCharacterStep({
    invalidateGeneratedOutputs,
    setError,
    upsertReferenceImage,
    removeReferenceImage,
    sheetUrl,
    advanceToSheet,
  });

  const {
    characterProfiles,
    loadingCharacterProfiles,
    runCharacters,
    selectedProfiles,
    artDirection,
    frameSheetReadiness,
    muapiVideoReadiness,
    refreshCharacterProfiles,
    onToggleRunProfile,
    isProfileSelectedForRun,
    onArtDirectionChange,
    onCreateProfile,
    onUpdateProfile,
    deleteCharacterProfileFromLibrary,
    reuseProfileSheet,
    saveSheetToSelectedProfiles,
    restoreCharacterSnapshot,
    buildCharacterAnchors,
    generateMuapiCharacterSheet,
    onUploadReference,
    deleteReferenceFromLibrary,
    referenceLibraryBusy,
    frameSheetExtraReferenceUrls,
    maxFrameSheetExtras,
    onToggleFrameSheetExtraReference,
    isFrameSheetExtraReferenceSelected,
  } = character;

  const frameSheetBlockedReason = useMemo(
    () => (frameSheetReadiness.ok ? null : frameSheetReadiness.reason),
    [frameSheetReadiness],
  );

  const runProfileIds = useMemo(
    () => runCharacters.map((run) => run.profileId),
    [runCharacters],
  );

  const {
    presets,
    applyCreatorPreset,
    saveCreatorPresetFromForm,
    deleteCreatorPresetById,
  } = useCreatorPresets({
    setTopic,
    setTone,
    setAudience,
    setNotes,
    setBasePrompt,
    setBrandKit,
    setArtDirection: character.setArtDirectionOverride,
  });

  const stepStates = useMemo(
    () =>
      getWizardStepStates({
        currentStep: step,
        scriptMode,
        topic,
        scriptEdit,
        scripts,
        sheetUrl,
        videoUrl,
      }),
    [scriptEdit, scripts, sheetUrl, step, scriptMode, topic, videoUrl],
  );

  const navigateToStep = useCallback(
    async (next: Step) => {
      if (next === step) return;
      if (!stepStates[next].accessible) return;

      if (busy) {
        toast.message("Wait for the current request before changing steps.");
        return;
      }

      if (
        step === "video" &&
        next !== "video" &&
        (pendingVideoJob !== null || videoGenerationBusy)
      ) {
        const ok = await confirm({
          title: "Leave video step?",
          description:
            "A video is still generating or processing. Leave this step? You can come back via the Video step.",
          confirmLabel: "Leave",
        });
        if (!ok) return;
      }

      setStep(next);
      setError(null);
      if (next === "scripts") {
        void loadSavedScripts();
      }
      if (next === "character") {
        void loadReferenceImages();
        void refreshCharacterProfiles();
      }
    },
    [
      busy,
      confirm,
      refreshCharacterProfiles,
      loadReferenceImages,
      loadSavedScripts,
      pendingVideoJob,
      step,
      stepStates,
      videoGenerationBusy,
    ],
  );

  const snapshot = useMemo<WizardSnapshot>(
    () => ({
      isScriptSidebarOpen,
      step,
      topic,
      tone,
      audience,
      notes,
      basePrompt,
      brandKit,
      scriptMode,
      saveManualScript,
      manualScriptSource,
      scripts,
      selectedId,
      scriptEdit,
      ...character.snapshotFields,
      sheetUrl,
      sheetSource,
      sheetScriptHistory,
      videoUrl,
      videoMeta,
      videoStatus,
      subtitleLanguage,
      subtitleVideoDurationSec,
      subtitleSrt,
      subtitleChars,
      videoHasCaptions,
      pendingVideoJob,
    }),
    [
      isScriptSidebarOpen,
      step,
      topic,
      tone,
      audience,
      notes,
      basePrompt,
      brandKit,
      scriptMode,
      saveManualScript,
      manualScriptSource,
      scripts,
      selectedId,
      scriptEdit,
      character.snapshotFields,
      sheetUrl,
      sheetSource,
      sheetScriptHistory,
      videoUrl,
      videoMeta,
      videoStatus,
      subtitleLanguage,
      subtitleVideoDurationSec,
      subtitleSrt,
      subtitleChars,
      videoHasCaptions,
      pendingVideoJob,
    ],
  );

  const restoreSnapshot = useCallback(
    (loaded: Partial<WizardSnapshot>) => {
      if (loaded.isScriptSidebarOpen !== undefined) {
        setIsScriptSidebarOpen(loaded.isScriptSidebarOpen);
      }
      if (loaded.step) setStep(loaded.step);
      if (loaded.topic !== undefined) setTopic(loaded.topic);
      if (loaded.tone !== undefined) setTone(loaded.tone);
      if (loaded.audience !== undefined) setAudience(loaded.audience);
      if (loaded.notes !== undefined) setNotes(loaded.notes);
      if (loaded.basePrompt !== undefined) setBasePrompt(loaded.basePrompt);
      if (loaded.brandKit !== undefined) setBrandKit(loaded.brandKit);
      if (loaded.scriptMode) setScriptMode(loaded.scriptMode);
      if (loaded.saveManualScript !== undefined) {
        setSaveManualScript(loaded.saveManualScript);
      }
      if (loaded.manualScriptSource) {
        setManualScriptSource(loaded.manualScriptSource);
      }
      if (loaded.scripts !== undefined) setScripts(loaded.scripts);
      if (loaded.selectedId !== undefined) setSelectedId(loaded.selectedId);
      if (loaded.scriptEdit) setScriptEdit(loaded.scriptEdit);
      restoreCharacterSnapshot(loaded);
      if (loaded.sheetUrl !== undefined) setSheetUrl(loaded.sheetUrl);
      if (loaded.sheetSource) setSheetSource(loaded.sheetSource);
      const restoredSheetUrl = loaded.sheetUrl?.trim();
      const restoredBody = loaded.scriptEdit?.body?.trim();
      const shouldRestoreHistory =
        loaded.sheetScriptHistory !== undefined ||
        Boolean(restoredSheetUrl && restoredBody && loaded.scriptEdit);
      if (shouldRestoreHistory) {
        setSheetScriptHistory((prev) => {
          let next = loaded.sheetScriptHistory ?? prev;
          if (restoredSheetUrl && restoredBody && loaded.scriptEdit) {
            const title = loaded.scriptEdit.title.trim() || "Untitled Script";
            if (!sheetScriptHistoryContains(next, title, restoredBody)) {
              next = upsertSheetScriptHistoryEntry(next, {
                title,
                body: restoredBody,
                scripts: loaded.scripts ?? null,
              });
            }
          }
          return next;
        });
      }
      if (loaded.videoUrl !== undefined) setVideoUrl(loaded.videoUrl);
      if (loaded.videoMeta !== undefined) setVideoMeta(loaded.videoMeta);
      if (loaded.videoStatus !== undefined) setVideoStatus(loaded.videoStatus);
      if (loaded.subtitleLanguage !== undefined) {
        setSubtitleLanguage(loaded.subtitleLanguage);
      }
      if (loaded.subtitleVideoDurationSec !== undefined) {
        setSubtitleVideoDurationSec(loaded.subtitleVideoDurationSec);
      }
      if (loaded.subtitleSrt !== undefined) setSubtitleSrt(loaded.subtitleSrt);
      if (loaded.subtitleChars !== undefined) setSubtitleChars(loaded.subtitleChars);
      if (loaded.videoHasCaptions !== undefined) {
        setVideoHasCaptions(loaded.videoHasCaptions);
      }
      if (loaded.pendingVideoJob !== undefined) {
        setPendingVideoJob(loaded.pendingVideoJob);
      }
      if (
        loaded.videoHasCaptions === undefined &&
        "captionedVideoUrl" in loaded &&
        typeof (loaded as { captionedVideoUrl?: string | null }).captionedVideoUrl ===
          "string"
      ) {
        const legacy = (loaded as { captionedVideoUrl: string }).captionedVideoUrl;
        setVideoUrl(legacy);
        setVideoHasCaptions(true);
      }
    },
    [restoreCharacterSnapshot],
  );

  const wizardStorageHydrated = useWizardLocalStorage<WizardSnapshot>({
    storageKey: WIZARD_STORAGE_KEY,
    restore: restoreSnapshot,
    snapshot,
  });

  const stepNeedsCharacterLibrary =
    step === "character" || step === "sheet" || step === "video";

  const staleRunSelection =
    runCharacters.length > 0 &&
    selectedProfiles.length !== runCharacters.length;

  useEffect(() => {
    if (!wizardStorageHydrated || !stepNeedsCharacterLibrary) return;
    void refreshCharacterProfiles();
    void loadReferenceImages();
  }, [
    wizardStorageHydrated,
    stepNeedsCharacterLibrary,
    refreshCharacterProfiles,
    loadReferenceImages,
  ]);

  useEffect(() => {
    if (!wizardStorageHydrated || !staleRunSelection) return;
    void refreshCharacterProfiles();
  }, [wizardStorageHydrated, staleRunSelection, refreshCharacterProfiles]);

  const continueToCharacter = useCallback(async () => {
    await continueToCharacterStep();
    void loadReferenceImages();
    void refreshCharacterProfiles();
  }, [
    continueToCharacterStep,
    refreshCharacterProfiles,
    loadReferenceImages,
  ]);

  const toggleScriptSidebar = useCallback(() => {
    const next = !isScriptSidebarOpen;
    setIsScriptSidebarOpen(next);
    if (next && !savedScriptsLoaded) void loadSavedScripts();
  }, [isScriptSidebarOpen, loadSavedScripts, savedScriptsLoaded]);

  const { generateSheet, startVideo } = useWizardSheetVideoGeneration({
    runApiAction,
    setError,
    setFrameSheetGenerationBusy,
    maybeSaveGeneratedScript,
    scriptEdit,
    artDirection,
    runProfileIds,
    characterProfiles,
    saveSheetToSelectedProfiles,
    buildCharacterAnchors,
    frameSheetExtraReferenceUrls,
    frameSheetReadiness,
    muapiVideoReadiness,
    recordSheetScriptHistory,
    recordSheetScriptHistoryWhenReady,
    setSheetUrl,
    setSheetSource,
    setStep,
    sheetUrl,
    videoProvider,
    muapiAudioDataUrls,
    setVideoGenerationBusy,
    setSubtitleSrt,
    setSubtitleChars,
    setSubtitleVideoDurationSec,
    setVideoStatus,
    setPendingVideoJob,
    setVideoMeta,
    onQuotaLimit: () => setFreeVideoLimitOpen(true),
    onVideoStarted: () => void videoQuota.refresh(),
  });

  const requestStartVideo = useCallback(() => {
    if (videoQuota.loading) return;
    if (!videoQuota.canStart) {
      setFreeVideoLimitOpen(true);
      return;
    }
    if (!videoQuota.exempt && videoQuota.used === 0 && !hasSeenFreeVideoNotice()) {
      pendingStartAfterNotice.current = true;
      setFreeVideoNoticeOpen(true);
      return;
    }
    void startVideo();
  }, [startVideo, videoQuota]);

  useEffect(() => {
    if (step !== "sheet" || !sheetUrl || videoQuota.loading) return;
    if (videoQuota.exempt || videoQuota.used !== 0 || hasSeenFreeVideoNotice()) {
      return;
    }
    setFreeVideoNoticeOpen(true);
  }, [step, sheetUrl, videoQuota.exempt, videoQuota.loading, videoQuota.used]);

  const onStartNewRun = useCallback(async () => {
    const hasInFlightJob =
      pendingVideoJob !== null ||
      videoGenerationBusy ||
      (busy && step === "video" && !videoUrl);

    if (hasInFlightJob) {
      const ok = await confirm({
        title: "Start a new run?",
        description:
          "A video is still generating or processing. Start a new run anyway? This job will no longer be tracked in the wizard.",
        confirmLabel: "Start new run",
      });
      if (!ok) return;
    }

    restoreSnapshot(createEmptyWizardSnapshot());
    clearMuapiAudio();
    setBusy(false);
    setVideoGenerationBusy(false);
    setExpandedHistoryId(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WIZARD_STORAGE_KEY);
    }
    toast.success("Ready for a new video.");
  }, [
    busy,
    clearMuapiAudio,
    confirm,
    pendingVideoJob,
    restoreSnapshot,
    step,
    videoGenerationBusy,
    videoUrl,
  ]);

  const onSavePreset = useCallback(
    (name: string) =>
      saveCreatorPresetFromForm(name, {
        topic,
        tone,
        audience,
        notes,
        basePrompt,
        brandKit,
        artDirection,
      }),
    [
      saveCreatorPresetFromForm,
      topic,
      tone,
      audience,
      notes,
      basePrompt,
      brandKit,
      artDirection,
    ],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 xl:pl-8 lg:flex lg:flex-row lg:gap-8 lg:pr-[380px]">
      <PipelineStepper
        variant="vertical"
        currentStep={step}
        stepStates={stepStates}
        busy={busy}
        onStepSelect={navigateToStep}
        className="hidden self-start lg:flex lg:sticky lg:top-24 lg:w-[200px] shrink-0 xl:w-[216px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <PipelineStepper
          variant="horizontal"
          currentStep={step}
          stepStates={stepStates}
          busy={busy}
          onStepSelect={navigateToStep}
          className="lg:hidden"
        />


      {error ? (
        <Alert
          variant="destructive"
          className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40"
        >
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}

      {step === "topic" ? (
        <TopicStep
          scriptMode={scriptMode}
          busy={busy}
          topic={topic}
          tone={tone}
          audience={audience}
          notes={notes}
          basePrompt={basePrompt}
          brandKit={brandKit}
          presets={presets}
          scriptEdit={scriptEdit}
          saveManualScript={saveManualScript}
          onScriptModeChange={setScriptMode}
          onTopicChange={setTopic}
          onToneChange={setTone}
          onAudienceChange={setAudience}
          onNotesChange={setNotes}
          onBasePromptChange={setBasePrompt}
          onBrandKitChange={setBrandKit}
          onApplyPreset={applyCreatorPreset}
          onSavePreset={onSavePreset}
          onDeletePreset={deleteCreatorPresetById}
          onScriptEditChange={onScriptEditChange}
          onSaveManualScriptChange={setSaveManualScript}
          onGenerateScripts={() => void generateScripts()}
          onContinueManual={() => void continueWithManualScript()}
          onUploadScriptFile={onUploadScriptFile}
          onLoadSavedScripts={() => void loadSavedScripts()}
          onManualBodyInput={() => setManualScriptSource("manual")}
        />
      ) : (
        <WizardSummaryCard
          title={scriptMode === "manual" ? "Manual Script Mode" : "Topic Defined"}
          detail={
            scriptMode === "manual" ? scriptEdit.title || "Custom script entry" : topic
          }
          onEdit={() => navigateToStep("topic")}
        />
      )}

      {step === "scripts" ? (
        <ScriptsStep
          scripts={scripts}
          selectedId={selectedId}
          selectedScript={selectedScript}
          scriptEdit={scriptEdit}
          busy={busy}
          onPickScript={onPickScript}
          onCreateNewScript={createNewScript}
          onScriptEditChange={onScriptEditChange}
          onContinueToCharacter={() => void continueToCharacter()}
        />
      ) : isScriptsDone && scriptEdit.body.trim() ? (
        <WizardSummaryCard
          title="Script Selected"
          detail={scriptEdit.title || "Untitled script"}
          onEdit={() => navigateToStep("scripts")}
        />
      ) : null}

      {step === "character" ? (
        <CharacterStep
          busy={busy}
          generatingFrameSheet={frameSheetGenerationBusy}
          library={{
            profiles: characterProfiles,
            loadingProfiles: loadingCharacterProfiles,
            isProfileSelectedForRun,
            runCharacterCount: runCharacters.length,
            staleRunSelection,
            referenceImages,
            loadingReferenceImages,
            referenceLibraryBusy,
            onToggleRunProfile,
            onDeleteProfile: (profile) =>
              void deleteCharacterProfileFromLibrary(profile),
            onCreateProfile,
            onUpdateProfile,
            onUploadReference,
            onDeleteReference: (item) => void deleteReferenceFromLibrary(item),
            onGenerateMuapiCharacterSheet: generateMuapiCharacterSheet,
          }}
          runSetup={{
            artDirection,
            selectedProfiles,
            generateBlockedReason: frameSheetBlockedReason,
            onArtDirectionChange,
            onReuseProfileSheet: reuseProfileSheet,
            onGenerateSheet: () => void generateSheet(),
            referenceImages,
            loadingReferenceImages,
            referenceLibraryBusy,
            onUploadReference,
            maxFrameSheetExtras,
            frameSheetExtraReferenceUrls,
            isFrameSheetExtraReferenceSelected,
            onToggleFrameSheetExtraReference,
          }}
        />
      ) : isCharacterDone && scriptEdit.body.trim() ? (
        <WizardSummaryCard
          title="Character Ready"
          detail={
            selectedProfiles.length
              ? selectedProfiles.map((p) => p.name).join(", ")
              : "No characters selected"
          }
          onEdit={() => navigateToStep("character")}
        />
      ) : null}

      {step === "sheet" && sheetUrl ? (
        <SheetStep
          busy={busy}
          sheetUrl={sheetUrl}
          sheetSource={sheetSource}
          videoProvider={videoProvider}
          onVideoProviderChange={persistVideoProvider}
          videoProviderEnvLoaded={videoProviderEnv.loaded}
          atlasConfigured={videoProviderEnv.atlasConfigured}
          muapiConfigured={videoProviderEnv.muapiConfigured}
          canStartVideo={canStartVideoWithQuota}
          videoGenerationBusy={videoGenerationBusy || Boolean(pendingVideoJob)}
          muapiAudioFileNames={muapiAudioFileNames}
          profileVoiceName={
            videoProvider === "muapi" && selectedProfiles.length && !muapiAudioFileNames.length
              ? selectedProfiles
                  .filter((p) => p.voiceSample)
                  .map((p) => p.name)
                  .join(", ") || null
              : null
          }
          onMuapiAudioFilesChange={onMuapiAudioFilesChange}
          onClearMuapiAudio={clearMuapiAudio}
          onStartVideo={requestStartVideo}
          onRegenerate={() => navigateToStep("character")}
        />
      ) : isSheetDone && sheetUrl ? (
        <WizardSummaryCard
          title="Frame Sequence Sheet Ready"
          detail="Ready for video generation"
          thumbnailUrl={sheetUrl}
          onEdit={() => navigateToStep("sheet")}
        />
      ) : null}

      {step === "video" ? (
        <VideoStep
          busy={busy || Boolean(pendingVideoJob) || videoGenerationBusy}
          videoStatus={videoStatus}
          videoUrl={videoUrl}
          sheetUrl={sheetUrl}
          subtitleSrt={subtitleSrt}
          subtitleLanguage={subtitleLanguage}
          subtitleChars={subtitleChars}
          subtitleVideoDurationSec={subtitleVideoDurationSec}
          videoHasCaptions={videoHasCaptions}
          videoMeta={videoMeta}
          videoStoredInLibrary={videoStoredInLibrary}
          onStartVideo={requestStartVideo}
          onStartNewRun={onStartNewRun}
          onGoTopic={() => navigateToStep("topic")}
          onGenerateSubtitles={() => void generateSubtitles()}
          onBurnSubtitles={() => void burnSubtitles()}
          onSubtitleLanguageChange={setSubtitleLanguage}
          onSubtitleVideoDurationKnown={setSubtitleVideoDurationSec}
          onSubtitleSrtChange={setSubtitleSrt}
        />
      ) : null}

      <ScriptHistorySidebar
        isOpen={isScriptSidebarOpen}
        loadingSavedScripts={loadingSavedScripts}
        savedScriptsLoaded={savedScriptsLoaded}
        savedScripts={savedScripts}
        currentBatchPrimaryScript={currentBatchPrimaryScript}
        currentBatchRemainingScripts={currentBatchRemainingScripts}
        activeScript={activeScript}
        expandedHistoryId={expandedHistoryId}
        sheetScriptHistory={sheetScriptHistory}
        onToggle={toggleScriptSidebar}
        onRefresh={() => void loadSavedScripts()}
        onApplySavedScript={(script) => {
          applyScriptFromHistory({ title: script.title, body: script.body });
        }}
        onPickCurrentBatchScript={(id) => {
          onPickScript(id);
          navigateToStep("scripts");
        }}
        onApplyHistoryScript={applyScriptFromHistory}
        onExpandedHistoryIdChange={setExpandedHistoryId}
      />
      </div>
      {confirmDialog}
      <FreeVideoModal
        open={freeVideoNoticeOpen}
        variant="notice"
        onClose={() => {
          markFreeVideoNoticeSeen();
          pendingStartAfterNotice.current = false;
          setFreeVideoNoticeOpen(false);
        }}
        onContinue={() => {
          markFreeVideoNoticeSeen();
          if (pendingStartAfterNotice.current) {
            pendingStartAfterNotice.current = false;
            void startVideo();
          }
        }}
      />
      <FreeVideoModal
        open={freeVideoLimitOpen}
        variant="limit"
        onClose={() => setFreeVideoLimitOpen(false)}
      />
    </div>
  );
}
