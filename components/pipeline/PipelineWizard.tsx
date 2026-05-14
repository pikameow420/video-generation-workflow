"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ScriptHistorySidebar } from "@/components/pipeline/ScriptHistorySidebar";
import { ScriptsStep } from "@/components/pipeline/steps/ScriptsStep";
import { SheetStep } from "@/components/pipeline/steps/SheetStep";
import { TopicStep } from "@/components/pipeline/steps/TopicStep";
import { VideoStep } from "@/components/pipeline/steps/VideoStep";
import type {
  ReferenceImage,
  SavedScript,
  ScriptMode,
  ScriptOption,
  SheetScriptHistoryEntry,
  Step,
  SubtitleLanguage,
  WizardSnapshot,
} from "@/components/pipeline/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApiAction } from "@/hooks/useApiAction";
import { useWizardLocalStorage } from "@/hooks/useWizardLocalStorage";
import { getJson, deleteJson, postForm, postJson } from "@/lib/api/client";
import {
  addCreatorPreset,
  loadCreatorPresets,
  removeCreatorPreset,
  type CreatorPreset,
} from "@/lib/pipeline/creator-presets";
import {
  burnSubtitlesResponseSchema,
  characterSheetResponseSchema,
  referenceImageListResponseSchema,
  referenceImageSchema,
  savedScriptListResponseSchema,
  savedScriptSchema,
  scriptsResponseSchema,
  transcribeSubtitlesResponseSchema,
  videoConfigResponseSchema,
  videoResponseSchema,
  type VideoProvider,
} from "@/lib/schemas";
import { Check } from "lucide-react";
import { toast } from "sonner";

const MAX_MANUAL_SCRIPT_FILE_BYTES = 256 * 1024;
const WIZARD_STORAGE_KEY = "video-pipeline-wizard-state-v1";
const MAX_REFERENCE_IMAGES = 9;
const VIDEO_PROVIDER_STORAGE_KEY = "pipeline-video-provider";

function readStoredVideoProvider(): VideoProvider | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(VIDEO_PROVIDER_STORAGE_KEY);
  return raw === "atlas" || raw === "muapi" ? raw : null;
}

function normalizeReferenceUrl(url: string): string {
  return url.trim();
}

function dedupeReferenceUrls(urls: string[]): string[] {
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

export function PipelineWizard() {
  const [isScriptSidebarOpen, setIsScriptSidebarOpen] = useState(true);
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [brandKit, setBrandKit] = useState("");
  const [presets, setPresets] = useState<CreatorPreset[]>([]);
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
  const [captionedVideoUrl, setCaptionedVideoUrl] = useState<string | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [videoProvider, setVideoProvider] = useState<VideoProvider>("atlas");
  const [videoProviderEnv, setVideoProviderEnv] = useState<{
    loaded: boolean;
    atlasConfigured: boolean;
    muapiConfigured: boolean;
  }>({
    loaded: false,
    atlasConfigured: false,
    muapiConfigured: false,
  });

  const videoBackendReady = useMemo(() => {
    if (!videoProviderEnv.loaded) return false;
    return (
      (videoProvider === "atlas" && videoProviderEnv.atlasConfigured) ||
      (videoProvider === "muapi" && videoProviderEnv.muapiConfigured)
    );
  }, [videoProvider, videoProviderEnv]);

  const persistVideoProvider = useCallback((next: VideoProvider) => {
    setVideoProvider(next);
    try {
      localStorage.setItem(VIDEO_PROVIDER_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await getJson(
          "/api/video/config",
          "Video provider config failed",
          videoConfigResponseSchema,
        );
        if (cancelled) return;

        const stored = readStoredVideoProvider();
        let next: VideoProvider = stored ?? cfg.defaultProvider;

        if (next === "atlas" && !cfg.atlasConfigured && cfg.muapiConfigured) {
          next = "muapi";
        }
        if (next === "muapi" && !cfg.muapiConfigured && cfg.atlasConfigured) {
          next = "atlas";
        }

        setVideoProvider(next);
        try {
          localStorage.setItem(VIDEO_PROVIDER_STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        setVideoProviderEnv({
          loaded: true,
          atlasConfigured: cfg.atlasConfigured,
          muapiConfigured: cfg.muapiConfigured,
        });
      } catch {
        if (!cancelled) {
          setVideoProviderEnv((prev) => ({ ...prev, loaded: true }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runApiAction = useApiAction({
    onError: (message) => {
      setError(message);
      toast.error(message);
    },
    setBusy,
    clearError: () => setError(null),
  });

  const selectedScript = scripts?.find((script) => script.id === selectedId) ?? null;
  const currentBatchPrimaryScript = scripts?.[0] ?? null;
  const currentBatchRemainingScripts = scripts?.slice(1) ?? [];
  const isScriptsDone = step === "sheet" || step === "video";
  const isSheetDone = step === "video";

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
      captionedVideoUrl,
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
      captionedVideoUrl,
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
    if (loaded.captionedVideoUrl !== undefined) {
      setCaptionedVideoUrl(loaded.captionedVideoUrl);
    }
  }, []);

  useWizardLocalStorage<WizardSnapshot>({
    storageKey: WIZARD_STORAGE_KEY,
    restore: restoreSnapshot,
    snapshot,
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setPresets(loadCreatorPresets());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCreatorPreset = useCallback((p: CreatorPreset) => {
    setTopic(p.topic);
    setTone(p.tone);
    setAudience(p.audience);
    setNotes(p.notes);
    setBasePrompt(p.basePrompt);
    setBrandKit(p.brandKit);
    setArtDirection(p.artDirection);
    toast.success(`Loaded “${p.name}”`);
  }, []);

  const saveCreatorPresetFromForm = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast.error("Name your preset first");
        return;
      }
      const preset: CreatorPreset = {
        id: crypto.randomUUID(),
        name: trimmed.slice(0, 80),
        createdAt: new Date().toISOString(),
        topic,
        tone,
        audience,
        notes,
        basePrompt,
        artDirection,
        brandKit,
      };
      setPresets(addCreatorPreset(preset));
      toast.success("Preset saved");
    },
    [topic, tone, audience, notes, basePrompt, artDirection, brandKit],
  );

  const deleteCreatorPresetById = useCallback((id: string) => {
    if (!id) return;
    setPresets(removeCreatorPreset(id));
    toast.success("Preset removed");
  }, []);

  const loadReferenceImages = useCallback(async () => {
    try {
      setLoadingReferenceImages(true);
      const data = await getJson(
        "/api/reference-images",
        "Could not load reference image library",
        referenceImageListResponseSchema,
      );
      setReferenceImages(data.items ?? []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load reference images",
      );
    } finally {
      setLoadingReferenceImages(false);
    }
  }, []);

  const loadSavedScripts = useCallback(async () => {
    try {
      setLoadingSavedScripts(true);
      const data = await getJson(
        "/api/scripts/library",
        "Failed to load saved scripts",
        savedScriptListResponseSchema,
      );
      setSavedScripts(data.items ?? []);
      setSavedScriptsLoaded(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load saved scripts");
    } finally {
      setLoadingSavedScripts(false);
    }
  }, []);

  const goScripts = useCallback(() => {
    setStep("scripts");
    setError(null);
    void loadReferenceImages();
    void loadSavedScripts();
  }, [loadReferenceImages, loadSavedScripts]);

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

  const startVideo = useCallback(async () => {
    if (!sheetUrl) return;
    toast.info("Preparing references and starting video job...");
    await runApiAction(async () => {
      setVideoUrl(null);
      setVideoMeta(null);
      setSubtitleSrt("");
      setSubtitleChars(null);
      setCaptionedVideoUrl(null);
      setSubtitleVideoDurationSec(null);
      setVideoStatus("Starting video job...");
      setStep("video");
      const data = await postJson(
        "/api/video",
        {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          imageDataUrlOrUrl: sheetUrl,
          provider: videoProvider,
        },
        "Video failed",
        videoResponseSchema,
      );
      setVideoUrl(data.videoUrl);
      setVideoMeta({ predictionId: data.predictionId });
      setVideoStatus("Done.");
      toast.success("Video generated.");
    }, "Request failed");
  }, [runApiAction, scriptEdit, sheetUrl, videoProvider]);

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
    setCaptionedVideoUrl(null);
    setSubtitleSrt("");
    setSubtitleChars(null);
    setSubtitleVideoDurationSec(null);
    setStep("sheet");
  }, [selectedReferenceUrls]);

  const generateSubtitles = useCallback(async () => {
    if (!videoUrl) return;
    if (subtitleLanguage === "script" && !scriptEdit.body.trim()) {
      toast.error("There is no script body to use for captions. Go back and pick or enter a script.");
      return;
    }
    toast.info("Generating subtitles...");
    await runApiAction(async () => {
      const payload: Record<string, unknown> = {
        videoUrl,
        language: subtitleLanguage,
      };
      if (subtitleLanguage === "script") {
        payload.scriptBody = scriptEdit.body.trim();
        if (
          subtitleVideoDurationSec != null &&
          Number.isFinite(subtitleVideoDurationSec) &&
          subtitleVideoDurationSec > 0
        ) {
          payload.videoDurationSec = subtitleVideoDurationSec;
        }
      }
      const data = await postJson(
        "/api/subtitles/transcribe",
        payload,
        "Subtitle generation failed",
        transcribeSubtitlesResponseSchema,
      );
      if (!data.srtText) throw new Error("Subtitle generation failed");
      setSubtitleSrt(data.srtText);
      setSubtitleChars(data.estimatedChars ?? null);
      setCaptionedVideoUrl(null);
      toast.success("Subtitles generated.");
    }, "Subtitle generation failed");
  }, [
    runApiAction,
    scriptEdit.body,
    subtitleLanguage,
    subtitleVideoDurationSec,
    videoUrl,
  ]);

  const burnSubtitles = useCallback(async () => {
    if (!videoUrl || !subtitleSrt.trim()) return;
    toast.info("Burning subtitles into video...");
    await runApiAction(async () => {
      const data = await postJson(
        "/api/subtitles/burn",
        { videoUrl, srtText: subtitleSrt },
        "Caption burn failed",
        burnSubtitlesResponseSchema,
      );
      if (!data.captionedVideoUrl) throw new Error("Caption burn failed");
      setCaptionedVideoUrl(data.captionedVideoUrl);
      toast.success("Captioned video ready.");
    }, "Caption burn failed");
  }, [runApiAction, subtitleSrt, videoUrl]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6 lg:pr-[380px]">
      <header className="mb-2 space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Script · Character Sheet · Seedance (
          {videoProvider === "muapi" ? "MuAPI" : "Atlas Cloud"})
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Video Pipeline
        </h1>
      </header>

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
          onSavePreset={saveCreatorPresetFromForm}
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
        <SummaryCard
          title={scriptMode === "manual" ? "Manual Script Mode" : "Topic Defined"}
          detail={
            scriptMode === "manual" ? scriptEdit.title || "Custom script entry" : topic
          }
          onEdit={() => setStep("topic")}
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
        <SummaryCard
          title="Script Selected"
          detail={scriptEdit.title || "Untitled script"}
          onEdit={goScripts}
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
          onStartVideo={() => void startVideo()}
          onRegenerate={() =>
            sheetSource === "uploaded" ? setStep("scripts") : void generateSheet()
          }
        />
      ) : isSheetDone && sheetUrl ? (
        <SummaryCard
          title="Character Sheet Generated"
          detail="Ready for video generation"
          thumbnailUrl={sheetUrl}
          onEdit={() => setStep("sheet")}
        />
      ) : null}

      {step === "video" ? (
        <VideoStep
          busy={busy}
          videoStatus={videoStatus}
          videoUrl={videoUrl}
          sheetUrl={sheetUrl}
          subtitleSrt={subtitleSrt}
          subtitleLanguage={subtitleLanguage}
          subtitleChars={subtitleChars}
          subtitleVideoDurationSec={subtitleVideoDurationSec}
          captionedVideoUrl={captionedVideoUrl}
          videoMeta={videoMeta}
          onStartVideo={() => void startVideo()}
          onGoTopic={() => setStep("topic")}
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
          setStep("scripts");
        }}
        onApplyHistoryScript={applyScriptFromHistory}
        onExpandedHistoryIdChange={setExpandedHistoryId}
      />
    </div>
  );
}

function SummaryCard({
  title,
  detail,
  thumbnailUrl,
  onEdit,
}: {
  title: string;
  detail: string;
  thumbnailUrl?: string;
  onEdit: () => void;
}) {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Done
              </span>
              <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              className="h-12 w-12 rounded-lg border object-cover dark:border-zinc-800"
              alt="Thumbnail"
            />
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}
