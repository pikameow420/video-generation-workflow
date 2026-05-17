"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import type { ReferenceImage, SavedScript } from "@/components/pipeline/types";
import { getJson } from "@/lib/api/client";
import {
  referenceImageListResponseSchema,
  savedScriptListResponseSchema,
} from "@/lib/schemas";

type SetErr = Dispatch<SetStateAction<string | null>>;

/** Reference + saved-script list loaders for Scripts step / sidebar. */
export function usePipelineLibraryApi(options: {
  setReferenceImages: Dispatch<SetStateAction<ReferenceImage[]>>;
  setLoadingReferenceImages: Dispatch<SetStateAction<boolean>>;
  setSavedScripts: Dispatch<SetStateAction<SavedScript[]>>;
  setSavedScriptsLoaded: Dispatch<SetStateAction<boolean>>;
  setLoadingSavedScripts: Dispatch<SetStateAction<boolean>>;
  setError: SetErr;
}): {
  loadReferenceImages: () => Promise<void>;
  loadSavedScripts: () => Promise<void>;
} {
  const {
    setReferenceImages,
    setLoadingReferenceImages,
    setSavedScripts,
    setSavedScriptsLoaded,
    setLoadingSavedScripts,
    setError,
  } = options;

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
  }, [setError, setLoadingReferenceImages, setReferenceImages]);

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
      setError(
        error instanceof Error ? error.message : "Failed to load saved scripts",
      );
    } finally {
      setLoadingSavedScripts(false);
    }
  }, [
    setError,
    setLoadingSavedScripts,
    setSavedScripts,
    setSavedScriptsLoaded,
  ]);

  return { loadReferenceImages, loadSavedScripts };
}
