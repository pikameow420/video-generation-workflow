"use client";

import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";

import type {
  CharacterProfile,
  ReferenceImage,
  WizardSnapshot,
} from "@/components/pipeline/types";
import type { RunApiAction } from "@/hooks/useApiAction";
import { useCharacterProfiles } from "@/hooks/useCharacterProfiles";
import { deleteJson, postForm } from "@/lib/api/client";
import {
  buildRunOverridesFromSnapshot,
  dedupeReferenceUrls,
  fetchVoiceSampleDataUrl,
  normalizeReferenceUrl,
  resolveRunReferenceUrls,
  type CharacterRunOverrides,
} from "@/lib/pipeline/wizard-utils";
import { referenceImageSchema } from "@/lib/schemas";

type CharacterSnapshotFields = Pick<
  WizardSnapshot,
  | "artDirection"
  | "selectedCharacterProfileId"
  | "useProfileVoice"
  | "selectedReferenceUrls"
>;

export type AdvanceToSheet = (args: {
  sheetUrl: string;
  sheetSource: "generated" | "uploaded";
  trackHistory?: boolean;
}) => void;

type UseWizardCharacterStepOptions = {
  invalidateGeneratedOutputs: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  runApiAction: RunApiAction;
  loadReferenceImages: () => Promise<void>;
  sheetUrl: string | null;
  advanceToSheet: AdvanceToSheet;
};

/** Character step state, run overrides, and CRUD for the pipeline wizard. */
export function useWizardCharacterStep(options: UseWizardCharacterStepOptions) {
  const {
    invalidateGeneratedOutputs,
    setError,
    runApiAction,
    loadReferenceImages,
    sheetUrl,
    advanceToSheet,
  } = options;

  const [characterProfiles, setCharacterProfiles] = useState<CharacterProfile[]>(
    [],
  );
  const [loadingCharacterProfiles, setLoadingCharacterProfiles] =
    useState(false);
  const [selectedCharacterProfileId, setSelectedCharacterProfileId] = useState<
    string | null
  >(null);
  const [useProfileVoice, setUseProfileVoice] = useState(true);
  const [runOverrides, setRunOverrides] = useState<CharacterRunOverrides>({});

  const {
    loadCharacterProfiles,
    deleteCharacterProfile,
    submitCreateProfile,
    submitUpdateProfile,
    saveProfileSheet,
  } = useCharacterProfiles({
    setCharacterProfiles,
    setLoadingCharacterProfiles,
    setError,
  });

  const selectedCharacterProfile =
    characterProfiles.find((profile) => profile.id === selectedCharacterProfileId) ??
    null;

  const effectiveArtDirection =
    runOverrides.artDirection ?? selectedCharacterProfile?.artDirection ?? "";

  const effectiveReferenceUrls = resolveRunReferenceUrls(
    runOverrides,
    selectedCharacterProfile,
  );

  const snapshotFields = useMemo<CharacterSnapshotFields>(
    () => ({
      artDirection: effectiveArtDirection,
      selectedCharacterProfileId,
      useProfileVoice,
      selectedReferenceUrls: effectiveReferenceUrls,
    }),
    [
      effectiveArtDirection,
      effectiveReferenceUrls,
      selectedCharacterProfileId,
      useProfileVoice,
    ],
  );

  const restoreCharacterSnapshot = useCallback(
    (loaded: Partial<CharacterSnapshotFields>) => {
      if (loaded.selectedCharacterProfileId !== undefined) {
        setSelectedCharacterProfileId(loaded.selectedCharacterProfileId);
      }
      if (loaded.useProfileVoice !== undefined) {
        setUseProfileVoice(loaded.useProfileVoice);
      }
      setRunOverrides(
        buildRunOverridesFromSnapshot({
          artDirection: loaded.artDirection,
          selectedReferenceUrls: loaded.selectedReferenceUrls,
        }),
      );
    },
    [],
  );

  /** After a localStorage restore, the selected profile's refs/voice live server-side — fetch once. */
  const attemptedProfileRestore = useRef(false);
  useEffect(() => {
    if (attemptedProfileRestore.current) return;
    if (!selectedCharacterProfileId) return;
    attemptedProfileRestore.current = true;
    void loadCharacterProfiles();
  }, [selectedCharacterProfileId, loadCharacterProfiles]);

  const applyCharacterProfile = useCallback(
    (profile: CharacterProfile) => {
      invalidateGeneratedOutputs();
      setSelectedCharacterProfileId(profile.id);
      setRunOverrides({});
      setUseProfileVoice(true);
    },
    [invalidateGeneratedOutputs],
  );

  const onSelectCharacterProfile = useCallback(
    (id: string | null) => {
      if (id === null) {
        invalidateGeneratedOutputs();
        setSelectedCharacterProfileId(null);
        setRunOverrides({});
        return;
      }
      const profile = characterProfiles.find((item) => item.id === id);
      if (!profile) return;
      applyCharacterProfile(profile);
      toast.success(`Using character profile "${profile.name}".`);
    },
    [applyCharacterProfile, characterProfiles, invalidateGeneratedOutputs],
  );

  const setArtDirectionOverride = useCallback(
    (next: SetStateAction<string>) => {
      setRunOverrides((prev) => {
        const current =
          prev.artDirection ?? selectedCharacterProfile?.artDirection ?? "";
        const value = typeof next === "function" ? next(current) : next;
        return { ...prev, artDirection: value };
      });
    },
    [selectedCharacterProfile],
  );

  const onArtDirectionChange = useCallback(
    (next: string) => {
      if (next !== effectiveArtDirection) {
        invalidateGeneratedOutputs();
      }
      setArtDirectionOverride(next);
    },
    [effectiveArtDirection, invalidateGeneratedOutputs, setArtDirectionOverride],
  );

  const onCreateProfile = useCallback(
    async (input: {
      name: string;
      artDirection: string;
      referenceImageIds: string[];
      voiceFile: File | null;
    }): Promise<boolean> =>
      submitCreateProfile(input, { onSuccess: applyCharacterProfile }),
    [applyCharacterProfile, submitCreateProfile],
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
    ): Promise<boolean> =>
      submitUpdateProfile(id, input, {
        onSuccess: (updated) => {
          if (selectedCharacterProfileId === updated.id) {
            applyCharacterProfile(updated);
          }
        },
      }),
    [applyCharacterProfile, selectedCharacterProfileId, submitUpdateProfile],
  );

  const deleteCharacterProfileFromLibrary = useCallback(
    async (profile: CharacterProfile) => {
      await runApiAction(async () => {
        await deleteCharacterProfile(profile.id);
        if (selectedCharacterProfileId === profile.id) {
          invalidateGeneratedOutputs();
          setSelectedCharacterProfileId(null);
          setRunOverrides({});
        }
        toast.success(`Character profile "${profile.name}" deleted.`);
      }, "Delete failed");
    },
    [
      deleteCharacterProfile,
      invalidateGeneratedOutputs,
      runApiAction,
      selectedCharacterProfileId,
    ],
  );

  const reuseProfileSheet = useCallback(() => {
    const saved = selectedCharacterProfile?.sheetUrl;
    if (!saved) return;
    advanceToSheet({
      sheetUrl: saved,
      sheetSource: "generated",
      trackHistory: true,
    });
    toast.success("Reusing the profile's saved frame sequence sheet.");
  }, [advanceToSheet, selectedCharacterProfile]);

  const saveSheetToSelectedProfile = useCallback(
    async (imageDataUrl: string) => {
      if (!selectedCharacterProfileId) return;
      await saveProfileSheet(selectedCharacterProfileId, imageDataUrl);
    },
    [saveProfileSheet, selectedCharacterProfileId],
  );

  const fetchProfileVoiceDataUrl = useCallback(async (): Promise<string | null> => {
    const voice = selectedCharacterProfile?.voiceSample;
    if (!voice) return null;
    return fetchVoiceSampleDataUrl(voice);
  }, [selectedCharacterProfile]);

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
        invalidateGeneratedOutputs();
        setRunOverrides((prev) => ({
          ...prev,
          referenceUrls: dedupeReferenceUrls([
            String(data.url),
            ...resolveRunReferenceUrls(prev, selectedCharacterProfile),
          ]),
        }));
        await loadReferenceImages();
        toast.success("Reference image uploaded.");
      }, "Upload failed");
    },
    [
      invalidateGeneratedOutputs,
      loadReferenceImages,
      runApiAction,
      selectedCharacterProfile,
    ],
  );

  const selectReferenceImage = useCallback(
    (url: string) => {
      const normalized = normalizeReferenceUrl(url);
      invalidateGeneratedOutputs();
      setRunOverrides((prev) => {
        const current = resolveRunReferenceUrls(prev, selectedCharacterProfile);
        const next = current.includes(normalized)
          ? current.filter((item) => item !== normalized)
          : dedupeReferenceUrls([normalized, ...current]);
        return { ...prev, referenceUrls: next };
      });
    },
    [invalidateGeneratedOutputs, selectedCharacterProfile],
  );

  const deleteReferenceFromLibrary = useCallback(
    async (item: ReferenceImage) => {
      await runApiAction(async () => {
        await deleteJson(
          `/api/reference-images?id=${encodeURIComponent(item.id)}`,
          "Failed to delete reference image",
        );
        const wasSelected = effectiveReferenceUrls.some(
          (url) => normalizeReferenceUrl(url) === normalizeReferenceUrl(item.url),
        );
        const wasUsedAsSheet = Boolean(
          sheetUrl &&
            normalizeReferenceUrl(sheetUrl) === normalizeReferenceUrl(item.url),
        );
        if (wasSelected || wasUsedAsSheet) {
          invalidateGeneratedOutputs();
        }
        setRunOverrides((prev) => {
          const current = resolveRunReferenceUrls(prev, selectedCharacterProfile);
          return {
            ...prev,
            referenceUrls: current.filter(
              (url) =>
                normalizeReferenceUrl(url) !== normalizeReferenceUrl(item.url),
            ),
          };
        });
        await loadReferenceImages();
        toast.success("Reference removed from library.");
      }, "Delete failed");
    },
    [
      effectiveReferenceUrls,
      invalidateGeneratedOutputs,
      loadReferenceImages,
      runApiAction,
      selectedCharacterProfile,
      sheetUrl,
    ],
  );

  const useSelectedReferenceDirectly = useCallback(() => {
    const first = effectiveReferenceUrls[0];
    if (!first) return;
    advanceToSheet({ sheetUrl: first, sheetSource: "uploaded" });
  }, [advanceToSheet, effectiveReferenceUrls]);

  return {
    characterProfiles,
    loadingCharacterProfiles,
    selectedCharacterProfileId,
    selectedCharacterProfile,
    useProfileVoice,
    setUseProfileVoice,
    effectiveArtDirection,
    effectiveReferenceUrls,
    snapshotFields,
    restoreCharacterSnapshot,
    loadCharacterProfiles,
    onSelectCharacterProfile,
    onArtDirectionChange,
    setArtDirectionOverride,
    onCreateProfile,
    onUpdateProfile,
    deleteCharacterProfileFromLibrary,
    reuseProfileSheet,
    saveSheetToSelectedProfile,
    fetchProfileVoiceDataUrl,
    onUploadReference,
    selectReferenceImage,
    deleteReferenceFromLibrary,
    useSelectedReferenceDirectly,
  };
}
