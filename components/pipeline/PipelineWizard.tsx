"use client";

import { ChangeEvent, useCallback, useMemo, useState } from "react";

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
import { ScriptsStep } from "@/components/pipeline/steps/ScriptsStep";
import { SheetStep } from "@/components/pipeline/steps/SheetStep";
import { TopicStep } from "@/components/pipeline/steps/TopicStep";
import { VideoStep } from "@/components/pipeline/steps/VideoStep";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  createEmptyWizardSnapshot,
  dedupeReferenceUrls,
  fileToDataUrl,
  getWizardStepStates,
  MAX_MANUAL_SCRIPT_FILE_BYTES,
  normalizeReferenceUrl,
  WIZARD_STORAGE_KEY,
} from "@/lib/pipeline/wizard-utils";
import { deleteJson, postForm, postJson } from "@/lib/api/client";
import { useApiAction } from "@/hooks/useApiAction";
import { useCreatorPresets } from "@/hooks/useCreatorPresets";
import { usePipelineLibraryApi } from "@/hooks/usePipelineLibraryApi";
import { usePipelineVideoProvider } from "@/hooks/usePipelineVideoProvider";
import { useWizardSubtitleActions } from "@/hooks/useWizardSubtitleActions";
import { useWizardPendingVideoJob } from "@/hooks/useWizardPendingVideoJob";
import { usePipelineVideoStored } from "@/hooks/usePipelineVideoStored";
import { useWizardLocalStorage } from "@/hooks/useWizardLocalStorage";
import {
  characterSheetResponseSchema,
  referenceImageSchema,
  savedScriptSchema,
  scriptsResponseSchema,
  maxMuapiAudioBytesPerFile,
  maxMuapiAudioFiles,
  videoStartResponseSchema,
} from "@/lib/schemas";
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
  const [artDirection, setArtDirection] = useState("");
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetSource, setSheetSource] = useState<"generated" | "uploaded">(
    "generated",
  );
  const [selectedReferenceUrls, setSelectedReferenceUrls] = useState<string[]>(
    [],
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
  /** MuAPI only: data URLs for optional voice reference audio (not persisted in localStorage). */
  const [muapiAudioDataUrls, setMuapiAudioDataUrls] = useState<string[]>([]);
  const [muapiAudioFileNames, setMuapiAudioFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setArtDirection,
  });

  const clearMuapiAudio = useCallback(() => {
    setMuapiAudioDataUrls([]);
    setMuapiAudioFileNames([]);
  }, []);

  const {
    videoProvider,
    persistVideoProvider,
    videoProviderEnv,
    videoBackendReady,
  } = usePipelineVideoProvider(clearMuapiAudio);

  const runApiAction = useApiAction({
    onError: (message) => {
      setError(message);
      toast.error(message);
    },
    setBusy,
    clearError: () => setError(null),
  });

  const { loadReferenceImages, loadSavedScripts } = usePipelineLibraryApi({
    setReferenceImages,
    setLoadingReferenceImages,
    setSavedScripts,
    setSavedScriptsLoaded,
    setLoadingSavedScripts,
    setError,
  });

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
  const currentBatchPrimaryScript = scripts?.[0] ?? null;
  const currentBatchRemainingScripts = scripts?.slice(1) ?? [];
  const isScriptsDone = step === "sheet" || step === "video";
  const isSheetDone = step === "video";

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
    (next: Step) => {
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
        const ok = window.confirm(
          "A video is still generating or processing. Leave this step? You can come back via the Video step.",
        );
        if (!ok) return;
      }

      setStep(next);
      setError(null);
      if (next === "scripts") {
        void loadReferenceImages();
        void loadSavedScripts();
      }
    },
    [
      busy,
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
      artDirection,
      sheetUrl,
      sheetSource,
      selectedReferenceUrls,
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
      artDirection,
      sheetUrl,
      sheetSource,
      selectedReferenceUrls,
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

  const restoreSnapshot = useCallback((loaded: Partial<WizardSnapshot>) => {
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
    if (loaded.artDirection !== undefined) setArtDirection(loaded.artDirection);
    if (loaded.sheetUrl !== undefined) setSheetUrl(loaded.sheetUrl);
    if (loaded.sheetSource) setSheetSource(loaded.sheetSource);
    if (loaded.selectedReferenceUrls) {
      setSelectedReferenceUrls(dedupeReferenceUrls(loaded.selectedReferenceUrls));
    }
    if (loaded.sheetScriptHistory) {
      setSheetScriptHistory(loaded.sheetScriptHistory);
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
  }, []);

  useWizardLocalStorage<WizardSnapshot>({
    storageKey: WIZARD_STORAGE_KEY,
    restore: restoreSnapshot,
    snapshot,
  });

  const onPickScript = useCallback(
    (id: string) => {
      setSelectedId(id);
      const script = scripts?.find((item) => item.id === id);
      if (script) {
        setScriptEdit({ title: script.title, body: script.body });
      }
    },
    [scripts],
  );

  const saveScriptToLibrary = useCallback(
    async (payload: {
      title: string;
      body: string;
      source: "generated" | "manual" | "uploaded";
    }) =>
      postJson(
        "/api/scripts/library",
        payload,
        "Could not save script",
        savedScriptSchema,
      ),
    [],
  );

  const maybeSaveGeneratedScript = useCallback(async () => {
    if (scriptMode !== "generate") return;
    const title = scriptEdit.title.trim();
    const body = scriptEdit.body.trim();
    if (!title || !body) return;
    const exists = savedScripts.some(
      (item) => item.title.trim() === title && item.body.trim() === body,
    );
    if (exists) return;
    const saved = await saveScriptToLibrary({ title, body, source: "generated" });
    setSavedScripts((prev) => [saved, ...prev]);
    setSavedScriptsLoaded(true);
  }, [savedScripts, saveScriptToLibrary, scriptEdit, scriptMode]);

  const saveGeneratedBatchToLibrary = useCallback(
    async (items: ScriptOption[]) => {
      const existing = new Set(
        savedScripts.map((item) => `${item.title.trim()}::${item.body.trim()}`),
      );
      const pending = items.filter((item) => {
        const key = `${item.title.trim()}::${item.body.trim()}`;
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      if (!pending.length) return;

      const saved: SavedScript[] = [];
      for (const item of pending) {
        try {
          const one = await saveScriptToLibrary({
            title: item.title,
            body: item.body,
            source: "generated",
          });
          saved.push(one);
        } catch {
          // Keep batch save resilient.
        }
      }
      if (saved.length) {
        setSavedScripts((prev) => [...saved, ...prev]);
        setSavedScriptsLoaded(true);
      }
    },
    [savedScripts, saveScriptToLibrary],
  );

  const generateScripts = useCallback(async () => {
    toast.info("Generating scripts...");
    await runApiAction(async () => {
      const data = await postJson(
        "/api/scripts",
        {
          topic,
          tone: tone || undefined,
          audience: audience || undefined,
          notes: notes || undefined,
          basePrompt: basePrompt || undefined,
          brandKit: brandKit.trim() || undefined,
        },
        "Scripts failed",
        scriptsResponseSchema,
      );
      const list = data.scripts;
      setScripts(list);
      setSelectedId(list[0]?.id ?? null);
      setScriptEdit({ title: list[0]?.title ?? "", body: list[0]?.body ?? "" });
      await saveGeneratedBatchToLibrary(list);
      setStep("scripts");
      await loadReferenceImages();
      await loadSavedScripts();
      toast.success("Scripts generated.");
    }, "Request failed");
  }, [
    audience,
    basePrompt,
    brandKit,
    loadReferenceImages,
    loadSavedScripts,
    notes,
    runApiAction,
    saveGeneratedBatchToLibrary,
    tone,
    topic,
  ]);

  const continueWithManualScript = useCallback(async () => {
    const trimmedTitle = scriptEdit.title.trim() || "Custom Script";
    const trimmedBody = scriptEdit.body.trim();
    if (!trimmedBody) {
      setError("Script body is required");
      return;
    }

    toast.info("Preparing script...");
    await runApiAction(async () => {
      setScripts(null);
      setSelectedId(null);
      setScriptEdit({ title: trimmedTitle, body: trimmedBody });
      if (saveManualScript) {
        const saved = await saveScriptToLibrary({
          title: trimmedTitle,
          body: trimmedBody,
          source: manualScriptSource,
        });
        setSavedScripts((prev) => [saved, ...prev]);
        setSavedScriptsLoaded(true);
      }
      await loadReferenceImages();
      await loadSavedScripts();
      setStep("scripts");
      toast.success("Script is ready.");
    }, "Failed to continue");
  }, [
    loadReferenceImages,
    loadSavedScripts,
    manualScriptSource,
    runApiAction,
    saveManualScript,
    saveScriptToLibrary,
    scriptEdit,
  ]);

  const onUploadScriptFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".txt") && !lowerName.endsWith(".md")) {
      setError("Only .txt and .md files are supported");
      return;
    }
    if (file.size > MAX_MANUAL_SCRIPT_FILE_BYTES) {
      setError("Script file is too large. Max size is 256KB");
      return;
    }

    try {
      const text = (await file.text()).trim();
      if (!text) {
        setError("Uploaded script file is empty");
        return;
      }
      const inferredTitle = file.name.replace(/\.(txt|md)$/i, "").trim();
      setScriptEdit((prev) => ({
        title: prev.title.trim() || inferredTitle || "Custom Script",
        body: text,
      }));
      setManualScriptSource("uploaded");
      setError(null);
    } catch {
      setError("Could not read uploaded script file");
    }
  }, []);

  const createNewScript = useCallback(() => {
    setScriptMode("manual");
    setScripts(null);
    setSelectedId(null);
    setScriptEdit({ title: "", body: "" });
    setManualScriptSource("manual");
    setStep("scripts");
    setError(null);
  }, []);

  const toggleScriptSidebar = useCallback(() => {
    const next = !isScriptSidebarOpen;
    setIsScriptSidebarOpen(next);
    if (next && !savedScriptsLoaded) void loadSavedScripts();
  }, [isScriptSidebarOpen, loadSavedScripts, savedScriptsLoaded]);

  const applyScriptFromHistory = useCallback((item: { title: string; body: string }) => {
    setScriptMode("manual");
    setScriptEdit({ title: item.title, body: item.body });
    setScripts(null);
    setSelectedId(null);
    setStep("scripts");
    setError(null);
  }, []);

  const trackSheetScriptSelection = useCallback(() => {
    const title = scriptEdit.title.trim() || "Untitled Script";
    const body = scriptEdit.body.trim();
    if (!body) return;

    const selectedKey = `${title}::${body}`;
    const remaining =
      scripts?.length
        ? scripts
            .filter((item) => `${item.title.trim()}::${item.body.trim()}` !== selectedKey)
            .map((item) => ({ title: item.title, body: item.body }))
        : [];
    const entry: SheetScriptHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      selectedScript: { title, body },
      remainingScripts: remaining,
      createdAt: new Date().toISOString(),
    };
    setSheetScriptHistory((prev) => {
      const deduped = prev.filter(
        (item) =>
          item.selectedScript.title.trim() !== title ||
          item.selectedScript.body.trim() !== body,
      );
      return [entry, ...deduped].slice(0, 20);
    });
    setExpandedHistoryId(null);
  }, [scriptEdit, scripts]);

  const generateSheet = useCallback(async () => {
    toast.info("Generating character sheet...");
    await runApiAction(async () => {
      await maybeSaveGeneratedScript();
      const data = await postJson(
        "/api/character-sheet",
        {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          artDirection: artDirection || undefined,
          referenceImageUrls: selectedReferenceUrls.length
            ? selectedReferenceUrls
            : undefined,
        },
        "Character sheet failed",
        characterSheetResponseSchema,
      );
      setSheetUrl(data.imageDataUrl);
      setSheetSource("generated");
      trackSheetScriptSelection();
      setStep("sheet");
      toast.success("Character sheet generated.");
    }, "Request failed");
  }, [
    artDirection,
    maybeSaveGeneratedScript,
    runApiAction,
    scriptEdit,
    selectedReferenceUrls,
    trackSheetScriptSelection,
  ]);
  
  const onStartNewRun = useCallback(() => {
    const hasInFlightJob =
      pendingVideoJob !== null ||
      videoGenerationBusy ||
      (busy && step === "video" && !videoUrl);

    if (hasInFlightJob) {
      const ok = window.confirm(
        "A video is still generating or processing. Start a new run anyway? This job will no longer be tracked in the wizard.",
      );
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
    pendingVideoJob,
    restoreSnapshot,
    step,
    videoGenerationBusy,
    videoUrl,
  ]);

  const onClearMuapiAudio = useCallback(() => {
    setMuapiAudioDataUrls([]);
    setMuapiAudioFileNames([]);
  }, []);

  const onMuapiAudioFilesChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.currentTarget.value = "";
      if (!files.length) return;

      const take = files.slice(0, maxMuapiAudioFiles);
      if (files.length > maxMuapiAudioFiles) {
        toast.info(`Using the first ${maxMuapiAudioFiles} audio files.`);
      }

      void (async () => {
        for (const f of take) {
          const lower = f.name.toLowerCase();
          if (!lower.endsWith(".mp3") && !lower.endsWith(".wav")) {
            toast.error("Voice reference must be MP3 or WAV.");
            return;
          }
          if (f.size > maxMuapiAudioBytesPerFile) {
            toast.error(
              `Each file must be ≤ ${Math.round(
                maxMuapiAudioBytesPerFile / (1024 * 1024),
              )}MB.`,
            );
            return;
          }
        }
        try {
          const urls: string[] = [];
          const names: string[] = [];
          for (const f of take) {
            urls.push(await fileToDataUrl(f));
            names.push(f.name);
          }
          setMuapiAudioDataUrls(urls);
          setMuapiAudioFileNames(names);
          toast.success(
            urls.length === 1
              ? "Voice reference attached for @audio1."
              : `${urls.length} audio samples attached (@audio1…@audio${urls.length}).`,
          );
        } catch {
          toast.error("Could not read audio files.");
        }
      })();
    },
    [],
  );

  const startVideo = useCallback(async () => {
    if (!sheetUrl) return;
    toast.info("Preparing references and starting video job...");
    await runApiAction(async () => {
      setVideoGenerationBusy(true);
      let jobStarted = false;
      try {
        setSubtitleSrt("");
        setSubtitleChars(null);
        setSubtitleVideoDurationSec(null);
        setVideoStatus("Starting video job…");
        setStep("video");
        const payload: Record<string, unknown> = {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          imageDataUrlOrUrl: sheetUrl,
          provider: videoProvider,
        };
        if (videoProvider === "muapi" && muapiAudioDataUrls.length > 0) {
          payload.audioDataUrls = muapiAudioDataUrls;
        }
        const data = await postJson(
          "/api/video",
          payload,
          "Video failed",
          videoStartResponseSchema,
        );
        const trimmedTitle = scriptEdit.title.trim().slice(0, 200);
        const job: PendingVideoJob = {
          predictionId: data.predictionId,
          provider: data.provider,
          startedAt: new Date().toISOString(),
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
        };
        setPendingVideoJob(job);
        setVideoMeta({ predictionId: data.predictionId });
        setVideoStatus("Generating video…");
        jobStarted = true;
      } finally {
        if (!jobStarted) setVideoGenerationBusy(false);
      }
    }, "Request failed");
  }, [runApiAction, scriptEdit, sheetUrl, videoProvider, muapiAudioDataUrls]);

  const onUploadReference = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.currentTarget.value = "";
      if (!file) return;

      toast.info("Uploading reference image...");
      await runApiAction(async () => {
        const formData = new FormData();
        formData.set("file", file);
        const data = await postForm(
          "/api/reference-images",
          formData,
          "Upload failed",
          referenceImageSchema,
        );
        if (!data.url) throw new Error("Upload failed: missing url");
        setSelectedReferenceUrls((prev) =>
          dedupeReferenceUrls([String(data.url), ...prev]),
        );
        await loadReferenceImages();
        toast.success("Reference image uploaded.");
      }, "Upload failed");
    },
    [loadReferenceImages, runApiAction],
  );

  const selectReferenceImage = useCallback((url: string) => {
    const normalized = normalizeReferenceUrl(url);
    setSelectedReferenceUrls((prev) => {
      const current = dedupeReferenceUrls(prev);
      return current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : dedupeReferenceUrls([normalized, ...current]);
    });
  }, []);

  const deleteReferenceFromLibrary = useCallback(
    async (item: ReferenceImage) => {
      await runApiAction(async () => {
        await deleteJson(
          `/api/reference-images?id=${encodeURIComponent(item.id)}`,
          "Failed to delete reference image",
        );
        setSelectedReferenceUrls((prev) =>
          prev.filter(
            (url) => normalizeReferenceUrl(url) !== normalizeReferenceUrl(item.url),
          ),
        );
        setSheetUrl((prev) =>
          prev && normalizeReferenceUrl(prev) === normalizeReferenceUrl(item.url)
            ? null
            : prev,
        );
        await loadReferenceImages();
        toast.success("Reference removed from library.");
      }, "Delete failed");
    },
    [loadReferenceImages, runApiAction],
  );

  const useSelectedReferenceDirectly = useCallback(() => {
    const first = selectedReferenceUrls[0];
    if (!first) return;
    setSheetUrl(first);
    setSheetSource("uploaded");
    setVideoUrl(null);
    setVideoMeta(null);
    setVideoHasCaptions(false);
    setSubtitleSrt("");
    setSubtitleChars(null);
    setSubtitleVideoDurationSec(null);
    setStep("sheet");
  }, [selectedReferenceUrls]);

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
          onScriptEditChange={setScriptEdit}
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
          artDirection={artDirection}
          busy={busy}
          referenceImages={referenceImages}
          selectedReferenceUrls={selectedReferenceUrls}
          loadingReferenceImages={loadingReferenceImages}
          onPickScript={onPickScript}
          onCreateNewScript={createNewScript}
          onScriptEditChange={setScriptEdit}
          onArtDirectionChange={setArtDirection}
          onUploadReference={onUploadReference}
          onRefreshReferences={() => void loadReferenceImages()}
          onSelectReferenceImage={selectReferenceImage}
          onRemoveReferenceImage={selectReferenceImage}
          onDeleteReferenceImage={(item) => void deleteReferenceFromLibrary(item)}
          onUseSelectedReferenceDirectly={useSelectedReferenceDirectly}
          onGenerateSheet={() => void generateSheet()}
        />
      ) : isScriptsDone && scriptEdit.body.trim() ? (
        <WizardSummaryCard
          title="Script Selected"
          detail={scriptEdit.title || "Untitled script"}
          onEdit={() => navigateToStep("scripts")}
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
          canStartVideo={videoBackendReady}
          videoGenerationBusy={videoGenerationBusy || Boolean(pendingVideoJob)}
          muapiAudioFileNames={muapiAudioFileNames}
          onMuapiAudioFilesChange={onMuapiAudioFilesChange}
          onClearMuapiAudio={onClearMuapiAudio}
          onStartVideo={() => void startVideo()}
          onRegenerate={() =>
            sheetSource === "uploaded"
              ? navigateToStep("scripts")
              : void generateSheet()
          }
        />
      ) : isSheetDone && sheetUrl ? (
        <WizardSummaryCard
          title="Character Sheet Generated"
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
          onStartVideo={() => void startVideo()}
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
        currentBatchPrimaryScript={currentBatchPrimaryScript}
        currentBatchRemainingScripts={currentBatchRemainingScripts}
        expandedHistoryId={expandedHistoryId}
        sheetScriptHistory={sheetScriptHistory}
        onToggle={toggleScriptSidebar}
        onRefresh={() => void loadSavedScripts()}
        onPickCurrentBatchScript={(id) => {
          onPickScript(id);
          navigateToStep("scripts");
        }}
        onApplyHistoryScript={applyScriptFromHistory}
        onExpandedHistoryIdChange={setExpandedHistoryId}
      />
      </div>
    </div>
  );
}
