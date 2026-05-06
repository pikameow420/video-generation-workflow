"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";

type ScriptOption = { id: string; title: string; body: string };
type SavedScript = {
  id: string;
  title: string;
  body: string;
  source: "generated" | "manual" | "uploaded";
  createdAt: string;
};
type ReferenceImage = {
  id: string;
  url: string;
  createdAt: string;
  originalName: string;
};

type Step = "topic" | "scripts" | "sheet" | "video";
type ScriptMode = "generate" | "manual";

const MAX_MANUAL_SCRIPT_FILE_BYTES = 256 * 1024;
const WIZARD_STORAGE_KEY = "video-pipeline-wizard-state-v1";

type WizardSnapshot = {
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
  videoUrl: string | null;
  videoMeta: { predictionId: string } | null;
  videoStatus: string;
  subtitleSrt: string;
  subtitleChars: number | null;
  captionedVideoUrl: string | null;
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`inline-block animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

export function PipelineWizard() {
  const [isScriptSidebarOpen, setIsScriptSidebarOpen] = useState(true);
  const [step, setStep] = useState<Step>("topic");
  
  // Topic state
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [scriptMode, setScriptMode] = useState<ScriptMode>("generate");
  const [saveManualScript, setSaveManualScript] = useState(true);
  const [manualScriptSource, setManualScriptSource] = useState<
    "manual" | "uploaded"
  >("manual");

  // Scripts state
  const [scripts, setScripts] = useState<ScriptOption[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scriptEdit, setScriptEdit] = useState({ title: "", body: "" });
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
  const [loadingSavedScripts, setLoadingSavedScripts] = useState(false);
  const [savedScriptsLoaded, setSavedScriptsLoaded] = useState(false);

  // Sheet state
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

  // Video state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ predictionId: string } | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>("");
  const [subtitleSrt, setSubtitleSrt] = useState("");
  const [subtitleChars, setSubtitleChars] = useState<number | null>(null);
  const [captionedVideoUrl, setCaptionedVideoUrl] = useState<string | null>(null);

  // Global UI state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedScript = scripts?.find((s) => s.id === selectedId) ?? null;

  const isScriptsDone = step === "sheet" || step === "video";
  const isSheetDone = step === "video";

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as Partial<WizardSnapshot>;

      if (snapshot.isScriptSidebarOpen !== undefined) {
        setIsScriptSidebarOpen(snapshot.isScriptSidebarOpen);
      }
      if (snapshot.step) setStep(snapshot.step);
      if (snapshot.topic !== undefined) setTopic(snapshot.topic);
      if (snapshot.tone !== undefined) setTone(snapshot.tone);
      if (snapshot.audience !== undefined) setAudience(snapshot.audience);
      if (snapshot.notes !== undefined) setNotes(snapshot.notes);
      if (snapshot.basePrompt !== undefined) setBasePrompt(snapshot.basePrompt);
      if (snapshot.scriptMode) setScriptMode(snapshot.scriptMode);
      if (snapshot.saveManualScript !== undefined) {
        setSaveManualScript(snapshot.saveManualScript);
      }
      if (snapshot.manualScriptSource) {
        setManualScriptSource(snapshot.manualScriptSource);
      }
      if (snapshot.scripts !== undefined) setScripts(snapshot.scripts);
      if (snapshot.selectedId !== undefined) setSelectedId(snapshot.selectedId);
      if (snapshot.scriptEdit) setScriptEdit(snapshot.scriptEdit);
      if (snapshot.artDirection !== undefined) setArtDirection(snapshot.artDirection);
      if (snapshot.sheetUrl !== undefined) setSheetUrl(snapshot.sheetUrl);
      if (snapshot.sheetSource) setSheetSource(snapshot.sheetSource);
      if (snapshot.selectedReferenceUrls) {
        setSelectedReferenceUrls(snapshot.selectedReferenceUrls);
      }
      if (snapshot.videoUrl !== undefined) setVideoUrl(snapshot.videoUrl);
      if (snapshot.videoMeta !== undefined) setVideoMeta(snapshot.videoMeta);
      if (snapshot.videoStatus !== undefined) setVideoStatus(snapshot.videoStatus);
      if (snapshot.subtitleSrt !== undefined) setSubtitleSrt(snapshot.subtitleSrt);
      if (snapshot.subtitleChars !== undefined) setSubtitleChars(snapshot.subtitleChars);
      if (snapshot.captionedVideoUrl !== undefined) {
        setCaptionedVideoUrl(snapshot.captionedVideoUrl);
      }
    } catch {
      // ignore corrupted local storage and continue with defaults
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot: WizardSnapshot = {
      isScriptSidebarOpen,
      step,
      topic,
      tone,
      audience,
      notes,
      basePrompt,
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
      videoUrl,
      videoMeta,
      videoStatus,
      subtitleSrt,
      subtitleChars,
      captionedVideoUrl,
    };
    window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    isScriptSidebarOpen,
    step,
    topic,
    tone,
    audience,
    notes,
    basePrompt,
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
    videoUrl,
    videoMeta,
    videoStatus,
    subtitleSrt,
    subtitleChars,
    captionedVideoUrl,
  ]);

  const loadReferenceImages = useCallback(async () => {
    try {
      setLoadingReferenceImages(true);
      const res = await fetch("/api/reference-images", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as {
        items?: ReferenceImage[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error || `Could not load library (${res.status})`);
      }
      setReferenceImages(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reference images");
    } finally {
      setLoadingReferenceImages(false);
    }
  }, []);

  const loadSavedScripts = useCallback(async () => {
    try {
      setLoadingSavedScripts(true);
      const res = await fetch("/api/scripts/library", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as {
        items?: SavedScript[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error || `Could not load saved scripts (${res.status})`);
      }
      setSavedScripts(data.items ?? []);
      setSavedScriptsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved scripts");
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

  const onPickScript = (id: string) => {
    setSelectedId(id);
    const s = scripts?.find((x) => x.id === id);
    if (s) {
      setScriptEdit({ title: s.title, body: s.body });
    }
  };

  const saveScriptToLibrary = useCallback(
    async (payload: {
      title: string;
      body: string;
      source: "generated" | "manual" | "uploaded";
    }) => {
      const res = await fetch("/api/scripts/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as SavedScript & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data?.error || `Could not save script (${res.status})`);
      }
      return data;
    },
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

    const saved = await saveScriptToLibrary({
      title,
      body,
      source: "generated",
    });
    setSavedScripts((prev) => [saved, ...prev]);
    setSavedScriptsLoaded(true);
  }, [scriptMode, scriptEdit, savedScripts, saveScriptToLibrary]);

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
          // Keep batch resilient; skip failed entries instead of breaking generation flow.
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
    setError(null);
    try {
      setBusy(true);
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tone: tone || undefined,
          audience: audience || undefined,
          notes: notes || undefined,
          basePrompt: basePrompt || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Scripts failed (${res.status})`);
      }
      const list = data.scripts as ScriptOption[];
      setScripts(list);
      setSelectedId(list[0]?.id ?? null);
      setScriptEdit({
        title: list[0]?.title ?? "",
        body: list[0]?.body ?? "",
      });
      await saveGeneratedBatchToLibrary(list);
      setStep("scripts");
      await loadReferenceImages();
      await loadSavedScripts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, [
    topic,
    tone,
    audience,
    notes,
    basePrompt,
    loadReferenceImages,
    loadSavedScripts,
    saveGeneratedBatchToLibrary,
  ]);

  const continueWithManualScript = async () => {
    const trimmedTitle = scriptEdit.title.trim() || "Custom Script";
    const trimmedBody = scriptEdit.body.trim();
    if (!trimmedBody) {
      setError("Script body is required");
      return;
    }

    setError(null);
    try {
      setBusy(true);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to continue");
    } finally {
      setBusy(false);
    }
  };

  const onUploadScriptFile = async (e: ChangeEvent<HTMLInputElement>) => {
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
  };

  const selectSavedScript = (item: SavedScript) => {
    setScriptEdit({ title: item.title, body: item.body });
    setScripts(null);
    setSelectedId(null);
    setStep("scripts");
    setError(null);
  };

  const createNewScript = () => {
    setScriptMode("manual");
    setScripts(null);
    setSelectedId(null);
    setScriptEdit({ title: "", body: "" });
    setManualScriptSource("manual");
    setStep("scripts");
    setError(null);
  };

  const toggleScriptSidebar = () => {
    const next = !isScriptSidebarOpen;
    setIsScriptSidebarOpen(next);
    if (next && !savedScriptsLoaded) {
      void loadSavedScripts();
    }
  };

  const generateSheet = async () => {
    setError(null);
    try {
      setBusy(true);
      await maybeSaveGeneratedScript();
      const res = await fetch("/api/character-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          artDirection: artDirection || undefined,
          referenceImageUrls:
            selectedReferenceUrls.length > 0
              ? selectedReferenceUrls
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Character sheet failed (${res.status})`);
      }
      setSheetUrl(data.imageDataUrl as string);
      setSheetSource("generated");
      setStep("sheet");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const startVideo = async () => {
    if (!sheetUrl) return;
    setError(null);
    try {
      setBusy(true);
      setVideoUrl(null);
      setVideoMeta(null);
      setSubtitleSrt("");
      setSubtitleChars(null);
      setCaptionedVideoUrl(null);
      setVideoStatus("Starting video job…");
      setStep("video");

      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          imageDataUrlOrUrl: sheetUrl,
          referenceImageUrls:
            selectedReferenceUrls.length > 0
              ? selectedReferenceUrls
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Video failed (${res.status})`);
      }
      setVideoUrl(data.videoUrl as string);
      setVideoMeta({
        predictionId: data.predictionId as string,
      });
      setVideoStatus("Done.");
    } catch (e) {
      setVideoStatus("");
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const onUploadReference = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;

    setError(null);
    try {
      setBusy(true);
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/reference-images", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data?.error || `Upload failed (${res.status})`);
      }
      setSelectedReferenceUrls((prev) =>
        prev.includes(data.url as string) ? prev : [data.url as string, ...prev],
      );
      await loadReferenceImages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const selectReferenceImage = (url: string) => {
    setSelectedReferenceUrls((prev) =>
      prev.includes(url) ? prev.filter((x) => x !== url) : [url, ...prev],
    );
    setError(null);
  };

  const useSelectedReferenceDirectly = () => {
    const first = selectedReferenceUrls[0];
    if (!first) {
      setError("Select at least one reference image first");
      return;
    }
    setSheetUrl(first);
    setSheetSource("uploaded");
    setStep("sheet");
    setError(null);
  };

  const generateSubtitles = async () => {
    if (!videoUrl) return;
    setError(null);
    try {
      setBusy(true);
      const res = await fetch("/api/subtitles/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        srtText?: string;
        estimatedChars?: number;
        error?: string;
      };
      if (!res.ok || !data.srtText) {
        throw new Error(data?.error || `Subtitle generation failed (${res.status})`);
      }
      setSubtitleSrt(data.srtText);
      setSubtitleChars(data.estimatedChars ?? null);
      setCaptionedVideoUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subtitle generation failed");
    } finally {
      setBusy(false);
    }
  };

  const burnSubtitles = async () => {
    if (!videoUrl || !subtitleSrt.trim()) return;
    setError(null);
    try {
      setBusy(true);
      const res = await fetch("/api/subtitles/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          srtText: subtitleSrt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        captionedVideoUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.captionedVideoUrl) {
        throw new Error(data?.error || `Caption burn failed (${res.status})`);
      }
      setCaptionedVideoUrl(data.captionedVideoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caption burn failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="space-y-2 mb-4">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Script → Character Sheet → Seedance (Atlas Cloud)
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Video Pipeline
        </h1>
      </header>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* STEP 1: TOPIC */}
      {step === "topic" ? (
        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">1</div>
            <h2 className="text-xl font-medium">What is this video about?</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setScriptMode("generate")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  scriptMode === "generate"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                Generate Scripts
              </button>
              <button
                type="button"
                onClick={() => {
                  setScriptMode("manual");
                  void loadSavedScripts();
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  scriptMode === "manual"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                Use My Own Script
              </button>
            </div>

            {scriptMode === "generate" ? (
              <>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Topic <span className="text-red-500">*</span></span>
                  <textarea
                    className="min-h-[88px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-offset-2 transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Why cold brew tastes smoother than iced coffee"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Tone</span>
                    <input
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="Witty, calm expert, hype..."
                    />
                  </label>
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Audience</span>
                    <input
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="e.g. first-time home baristas"
                    />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Notes</span>
                  <input
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Avoid brand names, CTA at end, etc."
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Base Prompt (Persistent instructions)</span>
                  <textarea
                    className="min-h-[88px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    value={basePrompt}
                    onChange={(e) => setBasePrompt(e.target.value)}
                    placeholder="e.g. Always be concise, use Gen Z slang, keep it funny"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !topic.trim()}
                  onClick={generateScripts}
                  className="flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {busy ? <><Spinner className="mr-2 h-4 w-4" /> Generating Scripts...</> : "Generate 4 Scripts"}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Script Title</span>
                  <input
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    value={scriptEdit.title}
                    onChange={(e) =>
                      setScriptEdit((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. 3 reasons cold brew feels smoother"
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Script Body <span className="text-red-500">*</span></span>
                  <textarea
                    className="min-h-[140px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    value={scriptEdit.body}
                    onChange={(e) => {
                      setManualScriptSource("manual");
                      setScriptEdit((prev) => ({ ...prev, body: e.target.value }));
                    }}
                    placeholder="Paste your script here..."
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                    Upload .txt/.md
                    <input
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      className="sr-only"
                      onChange={onUploadScriptFile}
                      disabled={busy}
                    />
                  </label>
                  <span className="text-xs text-zinc-500">Max 256KB</span>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={saveManualScript}
                    onChange={(e) => setSaveManualScript(e.target.checked)}
                  />
                  Save this script to library
                </label>
                <button
                  type="button"
                  disabled={busy || !scriptEdit.body.trim()}
                  onClick={continueWithManualScript}
                  className="flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {busy ? <><Spinner className="mr-2 h-4 w-4" /> Continuing...</> : "Continue to Character Sheet"}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">✓</div>
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {scriptMode === "manual" ? "Manual Script Mode" : "Topic Defined"}
              </h3>
              <p className="text-sm text-zinc-500 line-clamp-1">
                {scriptMode === "manual" ? scriptEdit.title || "Custom script entry" : topic}
              </p>
            </div>
          </div>
          <button onClick={() => setStep("topic")} className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Edit
          </button>
        </section>
      )}

      {/* STEP 2: SCRIPTS */}
      {step === "scripts" ? (
        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">2</div>
            <h2 className="text-xl font-medium">
              {scripts ? "Pick and polish a script" : "Review your script"}
            </h2>
          </div>

          {scripts ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {scripts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPickScript(s.id)}
                  className={`rounded-xl border p-4 text-left text-sm transition-all ${
                    selectedId === s.id
                      ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
                  }`}
                >
                  <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</span>
                  <span className="mt-2 line-clamp-3 leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {s.body}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selectedScript || !scripts ? (
            <div className="space-y-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Selected Script (Editable)
                </p>
                <button
                  type="button"
                  onClick={createNewScript}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Create New Script
                </button>
              </div>
              <input
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-zinc-400 outline-none transition-all dark:border-zinc-700 dark:bg-zinc-900"
                value={scriptEdit.title}
                onChange={(e) => setScriptEdit((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="min-h-[140px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed focus:ring-2 focus:ring-zinc-400 outline-none transition-all dark:border-zinc-700 dark:bg-zinc-900"
                value={scriptEdit.body}
                onChange={(e) => setScriptEdit((p) => ({ ...p, body: e.target.value }))}
              />
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Saved Scripts Library
              </p>
              <button
                type="button"
                onClick={() => void loadSavedScripts()}
                disabled={busy || loadingSavedScripts}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {loadingSavedScripts ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {savedScripts.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {savedScripts.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSavedScript(item)}
                    className="rounded-lg border border-zinc-200 bg-white p-3 text-left text-sm hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.body}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                No saved scripts yet. Add one from manual mode in step 1.
              </p>
            )}
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Art Direction for Visuals (Optional)
            </label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
              value={artDirection}
              onChange={(e) => setArtDirection(e.target.value)}
              placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
            />
            <p className="text-xs text-zinc-500">Image generation is billed separately.</p>
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Reuse Or Upload Your Own Photo
            </p>
            <p className="text-xs text-zinc-500">
              Selected references are used in character sheet generation and all selected assets are sent to video generation.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Upload Reference
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onUploadReference}
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                onClick={() => void loadReferenceImages()}
                disabled={busy || loadingReferenceImages}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {loadingReferenceImages ? "Refreshing..." : "Refresh Library"}
              </button>
            </div>
            {referenceImages.length ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {referenceImages.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectReferenceImage(item.url)}
                    className={`group overflow-hidden rounded-lg border text-left transition ${
                      selectedReferenceUrls.includes(item.url)
                        ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.originalName}
                      className="h-24 w-full object-cover"
                    />
                    <span className="block truncate px-2 py-1 text-xs text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                      {selectedReferenceUrls.includes(item.url) ? "Selected - " : ""}
                      {item.originalName}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                No saved references yet. Upload one to reuse it later.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={useSelectedReferenceDirectly}
                disabled={busy || !selectedReferenceUrls.length}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Use Selected Reference For Video
              </button>
              {selectedReferenceUrls.length ? (
                <span className="text-xs text-zinc-500">
                  {selectedReferenceUrls.length} reference{selectedReferenceUrls.length > 1 ? "s" : ""} selected
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={busy || !scriptEdit.title.trim() || !scriptEdit.body.trim()}
              onClick={generateSheet}
              className="flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? <><Spinner className="mr-2 h-4 w-4" /> Generating Art...</> : "Generate Character Sheet"}
            </button>
          </div>
        </section>
      ) : isScriptsDone && scriptEdit.body.trim() ? (
        <section className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">✓</div>
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Script Selected</h3>
              <p className="text-sm text-zinc-500 line-clamp-1">{scriptEdit.title || "Untitled script"}</p>
            </div>
          </div>
          <button onClick={goScripts} className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Edit
          </button>
        </section>
      ) : null}

      {/* STEP 3: SHEET */}
      {step === "sheet" && sheetUrl ? (
        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">3</div>
            <h2 className="text-xl font-medium">Review Character Sheet</h2>
          </div>
          
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sheetUrl}
              alt="Character sheet reference"
              className="w-full object-contain max-h-[400px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={startVideo}
              className="flex items-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? <><Spinner className="mr-2 h-4 w-4" /> Starting Video...</> : "Generate 15s Video"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={sheetSource === "uploaded" ? () => setStep("scripts") : generateSheet}
              className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {sheetSource === "uploaded" ? "Replace Reference" : "Regenerate Image"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Video generation uses Atlas Cloud Seedance reference-to-video (async).
          </p>
        </section>
      ) : isSheetDone && sheetUrl ? (
        <section className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">✓</div>
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Character Sheet Generated</h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sheetUrl} className="h-12 w-12 rounded border object-cover dark:border-zinc-800" alt="Thumbnail" />
            <button onClick={() => setStep("sheet")} className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Edit
            </button>
          </div>
        </section>
      ) : null}

      {/* STEP 4: VIDEO */}
      {step === "video" ? (
        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">4</div>
            <h2 className="text-xl font-medium">Final Video</h2>
          </div>

          {busy ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
              <Spinner className="h-8 w-8 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{videoStatus || "Working…"}</p>
                <p className="text-sm text-zinc-500">This can take several minutes. Please don&apos;t close the tab.</p>
              </div>
            </div>
          ) : null}

          {videoUrl ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
                <video
                  className="w-full max-h-[600px] object-contain"
                  src={videoUrl}
                  controls
                  playsInline
                  autoPlay
                />
              </div>
              <div className="flex items-center justify-between">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Download / Open Link ↗
                </a>
                <button
                  type="button"
                  onClick={() => setStep("topic")}
                  className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Start New Project
                </button>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Post-Generation Subtitles
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={generateSubtitles}
                    disabled={busy}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {busy ? "Working..." : "Generate Subtitles"}
                  </button>
                  <button
                    type="button"
                    onClick={burnSubtitles}
                    disabled={busy || !subtitleSrt.trim()}
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {busy ? "Burning..." : "Create Instagram-ready Video"}
                  </button>
                  {subtitleChars !== null ? (
                    <span className="text-xs text-zinc-500">
                      Subtitle chars: {subtitleChars}
                    </span>
                  ) : null}
                </div>

                <textarea
                  className="min-h-[140px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed focus:ring-2 focus:ring-zinc-400 outline-none transition-all dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Generated subtitles (SRT) will appear here..."
                  value={subtitleSrt}
                  onChange={(e) => setSubtitleSrt(e.target.value)}
                />
              </div>

              {captionedVideoUrl ? (
                <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Instagram-ready captioned video
                  </p>
                  <div className="overflow-hidden rounded-lg border border-zinc-200 bg-black dark:border-zinc-800">
                    <video
                      className="w-full max-h-[600px] object-contain"
                      src={captionedVideoUrl}
                      controls
                      playsInline
                    />
                  </div>
                  <a
                    href={captionedVideoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Download Captioned Video ↗
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          {!busy && !videoUrl ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => (sheetUrl ? startVideo() : setStep("topic"))}
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {sheetUrl ? "Retry Video Generation" : "Start Over"}
              </button>
            </div>
          ) : null}

          {videoMeta && !busy ? (
            <p className="text-xs text-zinc-500 border-t border-zinc-100 pt-4 mt-4 dark:border-zinc-800">
              Job ID: {videoMeta.predictionId}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="fixed right-4 top-24 z-20 hidden lg:flex lg:flex-col lg:items-end lg:gap-2">
        <button
          type="button"
          onClick={toggleScriptSidebar}
          className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isScriptSidebarOpen ? "Hide Scripts" : "Show Scripts"}
        </button>

        {isScriptSidebarOpen ? (
          <aside className="w-[320px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950/95">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Script History
              </h3>
              <button
                type="button"
                onClick={() => void loadSavedScripts()}
                disabled={loadingSavedScripts}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {loadingSavedScripts ? "..." : "Refresh"}
              </button>
            </div>

            {!savedScriptsLoaded && !loadingSavedScripts ? (
              <button
                type="button"
                onClick={() => void loadSavedScripts()}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Load previous scripts
              </button>
            ) : null}

            {scripts?.length ? (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Current Generated Batch
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {scripts.map((item) => (
                    <button
                      key={`generated-${item.id}`}
                      type="button"
                      onClick={() => {
                        onPickScript(item.id);
                        setStep("scripts");
                      }}
                      className={`w-full rounded-lg border p-3 text-left text-xs transition ${
                        selectedId === item.id
                          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                          : "border-zinc-200 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <p className="line-clamp-1 font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </p>
                      <p className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                        {item.body}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {savedScripts.length ? (
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {savedScripts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSavedScript(item)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left text-xs hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <p className="line-clamp-1 font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </p>
                    <p className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                      {item.body}
                    </p>
                    <p className="mt-1 uppercase tracking-wide text-[10px] text-zinc-500">
                      {item.source}
                    </p>
                  </button>
                ))}
              </div>
            ) : savedScriptsLoaded && !loadingSavedScripts ? (
              <p className="text-xs text-zinc-500">
                No previous scripts yet. Generate and pick one to reuse later.
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
