"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";

import { toast } from "sonner";

import type {
  CharacterProfile,
  ReferenceImage,
  RunCharacterSelection,
  WizardSnapshot,
} from "@/components/pipeline/types";
import { useCharacterProfiles } from "@/hooks/useCharacterProfiles";
import { deleteJson, postForm } from "@/lib/api/client";
import {
  assertRunReadyForFrameSheet,
  assertRunReadyForMuapiVideo,
} from "@/lib/pipeline/run-readiness";
import {
  buildCharacterAnchorsForSheet,
  MAX_REFERENCE_IMAGES,
  maxFrameSheetExtraReferences,
  migrateWizardSnapshot,
  toggleRunCharacter,
} from "@/lib/pipeline/wizard-utils";
import { referenceImageSchema } from "@/lib/schemas";

type CharacterSnapshotFields = Pick<
  WizardSnapshot,
  "artDirection" | "runCharacters" | "frameSheetExtraReferenceUrls"
>;

export type AdvanceToSheet = (args: {
  sheetUrl: string;
  sheetSource: "generated" | "uploaded";
  trackHistory?: boolean;
}) => void;

type UseWizardCharacterStepOptions = {
  invalidateGeneratedOutputs: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  upsertReferenceImage: (record: ReferenceImage) => void;
  removeReferenceImage: (id: string) => void;
  sheetUrl: string | null;
  advanceToSheet: AdvanceToSheet;
};

/** Character step state, multi-profile run selection, and CRUD for the pipeline wizard. */
export function useWizardCharacterStep(options: UseWizardCharacterStepOptions) {
  const {
    invalidateGeneratedOutputs,
    setError,
    upsertReferenceImage,
    removeReferenceImage,
    sheetUrl,
    advanceToSheet,
  } = options;

  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>(
    [],
  );
  const [loadingCharacterProfiles, setLoadingCharacterProfiles] =
    useState(false);
  const [runCharacters, setRunCharacters] = useState<RunCharacterSelection[]>(
    [],
  );
  const [artDirection, setArtDirection] = useState("");
  const [frameSheetExtraReferenceUrls, setFrameSheetExtraReferenceUrls] =
    useState<string[]>([]);
  const [referenceLibraryBusy, setReferenceLibraryBusy] = useState(false);

  const {
    loadCharacterProfiles,
    deleteCharacterProfile,
    submitCreateProfile,
    submitUpdateProfile,
    saveProfileSheet,
    generateMuapiCharacterSheet,
  } = useCharacterProfiles({
    setCharacterProfiles,
    setLoadingCharacterProfiles,
    setError,
  });

  const selectedProfiles = useMemo(
    () =>
      runCharacters
        .map((run) => characterProfiles.find((p) => p.id === run.profileId))
        .filter((p): p is CharacterProfile => p !== undefined),
    [characterProfiles, runCharacters],
  );

  const snapshotFields = useMemo<CharacterSnapshotFields>(
    () => ({
      artDirection,
      runCharacters,
      frameSheetExtraReferenceUrls,
    }),
    [artDirection, runCharacters, frameSheetExtraReferenceUrls],
  );

  const restoreCharacterSnapshot = useCallback(
    (loaded: Partial<WizardSnapshot>) => {
      const migrated = migrateWizardSnapshot(loaded);
      if (migrated.artDirection !== undefined) {
        setArtDirection(migrated.artDirection);
      }
      if (migrated.runCharacters !== undefined) {
        setRunCharacters(migrated.runCharacters);
      }
      if (migrated.frameSheetExtraReferenceUrls !== undefined) {
        setFrameSheetExtraReferenceUrls(migrated.frameSheetExtraReferenceUrls);
      }
    },
    [],
  );

  const characterSheetCount = useMemo(
    () =>
      runCharacters.filter((run) => {
        const profile = characterProfiles.find((p) => p.id === run.profileId);
        return Boolean(profile?.muapiCharacterSheetUrl);
      }).length,
    [characterProfiles, runCharacters],
  );

  const maxFrameSheetExtras = useMemo(
    () => maxFrameSheetExtraReferences(characterSheetCount),
    [characterSheetCount],
  );

  const frameSheetExtraReferenceUrlsForRun = useMemo(
    () => frameSheetExtraReferenceUrls.slice(0, maxFrameSheetExtras),
    [frameSheetExtraReferenceUrls, maxFrameSheetExtras],
  );

  const onToggleFrameSheetExtraReference = useCallback(
    (item: ReferenceImage) => {
      const url = item.url.trim();
      if (!url) return;
      setFrameSheetExtraReferenceUrls((prev) => {
        const key = url;
        if (prev.some((u) => u.trim() === key)) {
          return prev.filter((u) => u.trim() !== key);
        }
        if (prev.length >= maxFrameSheetExtras) {
          toast.error(
            `At most ${maxFrameSheetExtras} extra reference image${maxFrameSheetExtras === 1 ? "" : "s"} for this run (character sheets use ${characterSheetCount} of ${MAX_REFERENCE_IMAGES} slots).`,
          );
          return prev;
        }
        return [...prev, url];
      });
    },
    [characterSheetCount, maxFrameSheetExtras],
  );

  const isFrameSheetExtraReferenceSelected = useCallback(
    (item: ReferenceImage) =>
      frameSheetExtraReferenceUrls.some((u) => u.trim() === item.url.trim()),
    [frameSheetExtraReferenceUrls],
  );

  /** Load profiles from API and drop run selections that no longer exist. */
  const refreshCharacterProfiles = useCallback(async () => {
    const items = await loadCharacterProfiles();
    setRunCharacters((prev) =>
      prev.filter((run) => items.some((profile) => profile.id === run.profileId)),
    );
  }, [loadCharacterProfiles]);

  const onToggleRunProfile = useCallback(
    (profile: CharacterProfile) => {
      invalidateGeneratedOutputs();
      setRunCharacters((prev) => {
        const exists = prev.some((r) => r.profileId === profile.id);
        if (!exists && prev.length >= 3) {
          toast.error("At most 3 characters per run.");
          return prev;
        }
        const next = toggleRunCharacter(prev, profile.id, profile);
        if (next.length > prev.length) {
          toast.success(
            next.length === 1
              ? `Added "${profile.name}" to this run.`
              : `${next.length} characters selected for this run.`,
          );
        }
        return next;
      });
    },
    [invalidateGeneratedOutputs],
  );

  const onArtDirectionChange = useCallback(
    (next: string) => {
      if (next !== artDirection) invalidateGeneratedOutputs();
      setArtDirection(next);
    },
    [artDirection, invalidateGeneratedOutputs],
  );

  const onCreateProfile = useCallback(
    async (input: {
      name: string;
      artDirection: string;
      referenceImageIds: string[];
      voiceFile: File | null;
    }): Promise<boolean> =>
      submitCreateProfile(input, {
        onSuccess: (created) => {
          setRunCharacters((prev) =>
            toggleRunCharacter(prev, created.id, created),
          );
        },
      }),
    [submitCreateProfile],
  );

  const onUpdateProfile = useCallback(
    async (
      id: string,
      input: {
        name: string;
        artDirection: string;
        referenceImageIds: string[];
        voiceFile: File | null;
        removeVoiceSample: boolean;
      },
    ): Promise<boolean> => submitUpdateProfile(id, input),
    [submitUpdateProfile],
  );

  const deleteCharacterProfileFromLibrary = useCallback(
    async (profile: CharacterProfile) => {
      setReferenceLibraryBusy(true);
      try {
        await deleteCharacterProfile(profile.id);
        setRunCharacters((prev) =>
          prev.filter((item) => item.profileId !== profile.id),
        );
        toast.success(`Character profile "${profile.name}" deleted.`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        setError(message);
        toast.error(message);
      } finally {
        setReferenceLibraryBusy(false);
      }
    },
    [deleteCharacterProfile, setError],
  );

  const reuseProfileSheet = useCallback(() => {
    const saved = selectedProfiles.find((p) => p.sheetUrl)?.sheetUrl;
    if (!saved) return;
    advanceToSheet({
      sheetUrl: saved,
      sheetSource: "generated",
      trackHistory: true,
    });
    toast.success("Reusing a saved Video Sheet from a selected profile.");
  }, [advanceToSheet, selectedProfiles]);

  const saveSheetToSelectedProfiles = useCallback(
    async (imageDataUrl: string) => {
      for (const run of runCharacters) {
        await saveProfileSheet(run.profileId, imageDataUrl);
      }
    },
    [runCharacters, saveProfileSheet],
  );

  const buildCharacterAnchors = useCallback(
    () => buildCharacterAnchorsForSheet(runCharacters, characterProfiles),
    [characterProfiles, runCharacters],
  );

  const frameSheetReadiness = useMemo(
    () => assertRunReadyForFrameSheet(runCharacters, characterProfiles),
    [characterProfiles, runCharacters],
  );

  const muapiVideoReadiness = useMemo(
    () => assertRunReadyForMuapiVideo(runCharacters, characterProfiles),
    [characterProfiles, runCharacters],
  );

  const onUploadReference = useCallback(
    async (e: ChangeEvent<HTMLInputElement>): Promise<ReferenceImage | null> => {
      const file = e.target.files?.[0];
      e.currentTarget.value = "";
      if (!file) return null;

      toast.info("Uploading reference image...");
      setReferenceLibraryBusy(true);
      try {
        const formData = new FormData();
        formData.set("file", file);
        const data = await postForm(
          "/api/reference-images",
          formData,
          "Upload failed",
          referenceImageSchema,
        );
        if (!data.url) throw new Error("Upload failed: missing url");
        upsertReferenceImage(data);
        toast.success("Reference image uploaded.");
        return data;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setReferenceLibraryBusy(false);
      }
    },
    [setError, upsertReferenceImage],
  );

  const deleteReferenceFromLibrary = useCallback(
    async (item: ReferenceImage) => {
      setReferenceLibraryBusy(true);
      try {
        await deleteJson(
          `/api/reference-images?id=${encodeURIComponent(item.id)}`,
          "Failed to delete reference image",
        );
        const wasUsedAsSheet = Boolean(
          sheetUrl && sheetUrl.includes(item.url),
        );
        if (wasUsedAsSheet) invalidateGeneratedOutputs();
        removeReferenceImage(item.id);
        toast.success("Reference removed from library.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Delete failed";
        setError(message);
        toast.error(message);
      } finally {
        setReferenceLibraryBusy(false);
      }
    },
    [invalidateGeneratedOutputs, removeReferenceImage, setError, sheetUrl],
  );

  const isProfileSelectedForRun = useCallback(
    (profileId: string) => runCharacters.some((r) => r.profileId === profileId),
    [runCharacters],
  );

  return {
    characterProfiles,
    loadingCharacterProfiles,
    runCharacters,
    selectedProfiles,
    artDirection,
    frameSheetExtraReferenceUrls: frameSheetExtraReferenceUrlsForRun,
    maxFrameSheetExtras,
    onToggleFrameSheetExtraReference,
    isFrameSheetExtraReferenceSelected,
    snapshotFields,
    restoreCharacterSnapshot,
    refreshCharacterProfiles,
    onToggleRunProfile,
    isProfileSelectedForRun,
    onArtDirectionChange,
    setArtDirectionOverride: setArtDirection,
    onCreateProfile,
    onUpdateProfile,
    deleteCharacterProfileFromLibrary,
    reuseProfileSheet,
    saveSheetToSelectedProfiles,
    buildCharacterAnchors,
    frameSheetReadiness,
    muapiVideoReadiness,
    generateMuapiCharacterSheet,
    onUploadReference,
    deleteReferenceFromLibrary,
    referenceLibraryBusy,
  };
}
