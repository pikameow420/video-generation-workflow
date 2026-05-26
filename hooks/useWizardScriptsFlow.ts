"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import { toast } from "sonner";

import type {
  SavedScript,
  ScriptMode,
  ScriptOption,
  SheetScriptHistoryEntry,
  Step,
} from "@/components/pipeline/types";
import type { RunApiAction } from "@/hooks/useApiAction";
import { postJson } from "@/lib/api/client";
import { MAX_MANUAL_SCRIPT_FILE_BYTES } from "@/lib/pipeline/wizard-utils";
import { savedScriptSchema, scriptsResponseSchema } from "@/lib/schemas";

type UseWizardScriptsFlowOptions = {
  runApiAction: RunApiAction;
  invalidateGeneratedOutputs: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setStep: Dispatch<SetStateAction<Step>>;

  topic: string;
  tone: string;
  audience: string;
  notes: string;
  basePrompt: string;
  brandKit: string;
  scriptMode: ScriptMode;
  saveManualScript: boolean;
  manualScriptSource: "manual" | "uploaded";
  scripts: ScriptOption[] | null;
  selectedId: string | null;
  scriptEdit: { title: string; body: string };
  savedScripts: SavedScript[];

  setScriptMode: Dispatch<SetStateAction<ScriptMode>>;
  setScripts: Dispatch<SetStateAction<ScriptOption[] | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setScriptEdit: Dispatch<SetStateAction<{ title: string; body: string }>>;
  setManualScriptSource: Dispatch<SetStateAction<"manual" | "uploaded">>;
  setSavedScripts: Dispatch<SetStateAction<SavedScript[]>>;
  setSavedScriptsLoaded: Dispatch<SetStateAction<boolean>>;

  setSheetScriptHistory: Dispatch<SetStateAction<SheetScriptHistoryEntry[]>>;
  setExpandedHistoryId: Dispatch<SetStateAction<string | null>>;

  loadReferenceImages: () => Promise<void>;
  loadSavedScripts: () => Promise<void>;
};

/** Topic/scripts step handlers and script library persistence for the pipeline wizard. */
export function useWizardScriptsFlow(options: UseWizardScriptsFlowOptions) {
  const {
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
  } = options;

  const trackSheetScriptSelection = useCallback(() => {
    const title = scriptEdit.title.trim() || "Untitled Script";
    const body = scriptEdit.body.trim();
    if (!body) return;

    const selectedKey = `${title}::${body}`;
    const remaining =
      scripts?.length
        ? scripts
            .filter(
              (item) =>
                `${item.title.trim()}::${item.body.trim()}` !== selectedKey,
            )
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
  }, [scriptEdit, scripts, setExpandedHistoryId, setSheetScriptHistory]);

  const onPickScript = useCallback(
    (id: string) => {
      setSelectedId(id);
      const script = scripts?.find((item) => item.id === id);
      if (script) {
        if (
          script.title !== scriptEdit.title ||
          script.body !== scriptEdit.body
        ) {
          invalidateGeneratedOutputs();
        }
        setScriptEdit({ title: script.title, body: script.body });
      }
    },
    [invalidateGeneratedOutputs, scriptEdit, scripts, setScriptEdit, setSelectedId],
  );

  const onScriptEditChange = useCallback(
    (next: { title: string; body: string }) => {
      if (next.title !== scriptEdit.title || next.body !== scriptEdit.body) {
        invalidateGeneratedOutputs();
      }
      setScriptEdit(next);
    },
    [invalidateGeneratedOutputs, scriptEdit, setScriptEdit],
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
  }, [
    savedScripts,
    saveScriptToLibrary,
    scriptEdit,
    scriptMode,
    setSavedScripts,
    setSavedScriptsLoaded,
  ]);

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
    [savedScripts, saveScriptToLibrary, setSavedScripts, setSavedScriptsLoaded],
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
      invalidateGeneratedOutputs();
      setScripts(list);
      setSelectedId(list[0]?.id ?? null);
      setScriptEdit({ title: list[0]?.title ?? "", body: list[0]?.body ?? "" });
      await saveGeneratedBatchToLibrary(list);
      setStep("scripts");
      await Promise.all([loadReferenceImages(), loadSavedScripts()]);
      toast.success("Scripts generated.");
    }, "Request failed");
  }, [
    audience,
    basePrompt,
    brandKit,
    invalidateGeneratedOutputs,
    loadReferenceImages,
    loadSavedScripts,
    notes,
    runApiAction,
    saveGeneratedBatchToLibrary,
    setScriptEdit,
    setScripts,
    setSelectedId,
    setStep,
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
      await Promise.all([loadReferenceImages(), loadSavedScripts()]);
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
    setError,
    setScriptEdit,
    setScripts,
    setSelectedId,
    setSavedScripts,
    setSavedScriptsLoaded,
    setStep,
  ]);

  const onUploadScriptFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
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
        invalidateGeneratedOutputs();
        setScriptEdit((prev) => ({
          title: prev.title.trim() || inferredTitle || "Custom Script",
          body: text,
        }));
        setManualScriptSource("uploaded");
        setError(null);
      } catch {
        setError("Could not read uploaded script file");
      }
    },
    [
      invalidateGeneratedOutputs,
      setError,
      setManualScriptSource,
      setScriptEdit,
    ],
  );

  const createNewScript = useCallback(() => {
    invalidateGeneratedOutputs();
    setScriptMode("manual");
    setScripts(null);
    setSelectedId(null);
    setScriptEdit({ title: "", body: "" });
    setManualScriptSource("manual");
    setStep("scripts");
    setError(null);
  }, [
    invalidateGeneratedOutputs,
    setError,
    setManualScriptSource,
    setScriptEdit,
    setScriptMode,
    setScripts,
    setSelectedId,
    setStep,
  ]);

  const applyScriptFromHistory = useCallback(
    (item: { title: string; body: string }) => {
      if (
        item.title !== scriptEdit.title ||
        item.body !== scriptEdit.body
      ) {
        invalidateGeneratedOutputs();
      }
      setScriptMode("manual");
      setScriptEdit({ title: item.title, body: item.body });
      setScripts(null);
      setSelectedId(null);
      setStep("scripts");
      setError(null);
    },
    [
      invalidateGeneratedOutputs,
      scriptEdit,
      setError,
      setScriptEdit,
      setScriptMode,
      setScripts,
      setSelectedId,
      setStep,
    ],
  );

  /** Saves script if needed and moves to the character step (no library loads). */
  const continueToCharacterStep = useCallback(async () => {
    if (!scriptEdit.body.trim()) {
      setError("Script body is required");
      return;
    }
    await runApiAction(async () => {
      await maybeSaveGeneratedScript();
      setStep("character");
    }, "Failed to continue");
  }, [maybeSaveGeneratedScript, runApiAction, scriptEdit, setError, setStep]);

  return {
    trackSheetScriptSelection,
    onPickScript,
    onScriptEditChange,
    maybeSaveGeneratedScript,
    generateScripts,
    continueWithManualScript,
    onUploadScriptFile,
    createNewScript,
    applyScriptFromHistory,
    continueToCharacterStep,
  };
}
