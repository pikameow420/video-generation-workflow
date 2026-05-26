"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { toast } from "sonner";

import type { CharacterProfile } from "@/lib/schemas";
import { deleteJson, getJson, postForm, putForm, putJson } from "@/lib/api/client";
import {
  characterProfileListResponseSchema,
  characterProfileSchema,
} from "@/lib/schemas";

export type CreateCharacterProfilePayload = {
  name: string;
  artDirection: string;
  referenceImageIds: string[];
  voiceFile: File | null;
};

export type UpdateCharacterProfilePayload = CreateCharacterProfilePayload & {
  /** Clear the stored voice sample without uploading a replacement. */
  removeVoiceSample: boolean;
};

type ProfileSubmitOptions = {
  onSuccess?: (profile: CharacterProfile) => void;
};

export function useCharacterProfiles(options: {
  setCharacterProfiles: Dispatch<SetStateAction<CharacterProfile[]>>;
  setLoadingCharacterProfiles: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): {
  loadCharacterProfiles: () => Promise<void>;
  createCharacterProfile: (
    payload: CreateCharacterProfilePayload,
  ) => Promise<CharacterProfile>;
  updateCharacterProfile: (
    id: string,
    payload: UpdateCharacterProfilePayload,
  ) => Promise<CharacterProfile>;
  deleteCharacterProfile: (id: string) => Promise<void>;
  submitCreateProfile: (
    input: CreateCharacterProfilePayload,
    options?: ProfileSubmitOptions,
  ) => Promise<boolean>;
  submitUpdateProfile: (
    id: string,
    input: UpdateCharacterProfilePayload,
    options?: ProfileSubmitOptions,
  ) => Promise<boolean>;
  saveProfileSheet: (id: string, imageDataUrl: string) => Promise<void>;
} {
  const { setCharacterProfiles, setLoadingCharacterProfiles, setError } = options;

  const loadCharacterProfiles = useCallback(async () => {
    try {
      setLoadingCharacterProfiles(true);
      const data = await getJson(
        "/api/character-profiles",
        "Could not load character profiles",
        characterProfileListResponseSchema,
      );
      setCharacterProfiles(data.items ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load character profiles",
      );
    } finally {
      setLoadingCharacterProfiles(false);
    }
  }, [setCharacterProfiles, setError, setLoadingCharacterProfiles]);

  const createCharacterProfile = useCallback(
    async (payload: CreateCharacterProfilePayload) => {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          name: payload.name,
          artDirection: payload.artDirection,
          referenceImageIds: payload.referenceImageIds,
        }),
      );
      if (payload.voiceFile) {
        form.set("voiceSample", payload.voiceFile);
      }
      const created = await postForm(
        "/api/character-profiles",
        form,
        "Could not create character profile",
        characterProfileSchema,
      );
      setCharacterProfiles((prev) => [created, ...prev]);
      return created;
    },
    [setCharacterProfiles],
  );

  const updateCharacterProfile = useCallback(
    async (id: string, payload: UpdateCharacterProfilePayload) => {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          name: payload.name,
          artDirection: payload.artDirection,
          referenceImageIds: payload.referenceImageIds,
          removeVoiceSample: payload.removeVoiceSample,
        }),
      );
      if (payload.voiceFile) {
        form.set("voiceSample", payload.voiceFile);
      }
      const updated = await putForm(
        `/api/character-profiles/${encodeURIComponent(id)}`,
        form,
        "Could not update character profile",
        characterProfileSchema,
      );
      setCharacterProfiles((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },
    [setCharacterProfiles],
  );

  const deleteCharacterProfile = useCallback(
    async (id: string) => {
      await deleteJson(
        `/api/character-profiles/${encodeURIComponent(id)}`,
        "Failed to delete character profile",
      );
      setCharacterProfiles((prev) => prev.filter((item) => item.id !== id));
    },
    [setCharacterProfiles],
  );

  const submitCreateProfile = useCallback(
    async (
      input: CreateCharacterProfilePayload,
      submitOptions?: ProfileSubmitOptions,
    ): Promise<boolean> => {
      const name = input.name.trim();
      if (!name) {
        toast.error("Give this character a name.");
        return false;
      }
      if (!input.referenceImageIds.length) {
        toast.error("Pick at least one reference image.");
        return false;
      }
      try {
        setError(null);
        const created = await createCharacterProfile({
          name,
          artDirection: input.artDirection.trim(),
          referenceImageIds: input.referenceImageIds,
          voiceFile: input.voiceFile,
        });
        toast.success(`Character "${created.name}" saved.`);
        submitOptions?.onSuccess?.(created);
        return true;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not create character profile";
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [createCharacterProfile, setError],
  );

  const submitUpdateProfile = useCallback(
    async (
      id: string,
      input: UpdateCharacterProfilePayload,
      submitOptions?: ProfileSubmitOptions,
    ): Promise<boolean> => {
      const name = input.name.trim();
      if (!name) {
        toast.error("Give this character a name.");
        return false;
      }
      if (!input.referenceImageIds.length) {
        toast.error("Pick at least one reference image.");
        return false;
      }
      try {
        setError(null);
        const updated = await updateCharacterProfile(id, {
          name,
          artDirection: input.artDirection.trim(),
          referenceImageIds: input.referenceImageIds,
          voiceFile: input.voiceFile,
          removeVoiceSample: input.removeVoiceSample,
        });
        toast.success(`Character "${updated.name}" updated.`);
        submitOptions?.onSuccess?.(updated);
        return true;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not update character profile";
        setError(message);
        toast.error(message);
        return false;
      }
    },
    [setError, updateCharacterProfile],
  );

  const saveProfileSheet = useCallback(
    async (id: string, imageDataUrl: string) => {
      try {
        const updated = await putJson(
          `/api/character-profiles/${encodeURIComponent(id)}/sheet`,
          { imageDataUrl },
          "Could not save the sheet to the profile",
          characterProfileSchema,
        );
        setCharacterProfiles((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not save the sheet to the profile",
        );
      }
    },
    [setCharacterProfiles],
  );

  return {
    loadCharacterProfiles,
    createCharacterProfile,
    updateCharacterProfile,
    deleteCharacterProfile,
    submitCreateProfile,
    submitUpdateProfile,
    saveProfileSheet,
  };
}
