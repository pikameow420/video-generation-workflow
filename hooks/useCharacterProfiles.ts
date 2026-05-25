"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import type { CharacterProfile } from "@/components/pipeline/types";
import { deleteJson, getJson, postForm, putForm } from "@/lib/api/client";
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

/** Character profile list/create/delete API calls for the Character step. */
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
        `/api/character-profiles?id=${encodeURIComponent(id)}`,
        "Failed to delete character profile",
      );
      setCharacterProfiles((prev) => prev.filter((item) => item.id !== id));
    },
    [setCharacterProfiles],
  );

  return {
    loadCharacterProfiles,
    createCharacterProfile,
    updateCharacterProfile,
    deleteCharacterProfile,
  };
}
