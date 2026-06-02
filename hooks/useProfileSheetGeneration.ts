"use client";

import { useCallback, useState } from "react";

import type { CharacterProfile } from "@/components/pipeline/types";
import type { UpdateCharacterProfilePayload } from "@/hooks/useCharacterProfiles";

export function referenceIdsChanged(
  formIds: string[],
  savedIds: string[],
): boolean {
  if (formIds.length !== savedIds.length) return true;
  return formIds.some((id) => !savedIds.includes(id));
}

type GenerateSheetFromFormArgs = {
  profileId: string;
  formName: string;
  formArtDirection: string;
  formReferenceIds: string[];
  formVoiceFile: File | null;
  formKeepExistingVoice: boolean;
  editingProfile: CharacterProfile;
  onUpdateProfile: (
    id: string,
    input: UpdateCharacterProfilePayload,
  ) => Promise<boolean>;
  onGenerateCharacterSheet: (
    profileId: string,
    options?: { referenceImageIds: string[] },
  ) => Promise<unknown>;
};

export function useProfileSheetGeneration() {
  const [generatingCharSheet, setGeneratingCharSheet] = useState(false);

  const generateSheetFromForm = useCallback(
    async (args: GenerateSheetFromFormArgs) => {
      const {
        profileId,
        formName,
        formArtDirection,
        formReferenceIds,
        formVoiceFile,
        formKeepExistingVoice,
        editingProfile,
        onUpdateProfile,
        onGenerateCharacterSheet,
      } = args;

      setGeneratingCharSheet(true);
      try {
        const savedIds = editingProfile.referenceImages.map((item) => item.id);
        if (referenceIdsChanged(formReferenceIds, savedIds)) {
          const saved = await onUpdateProfile(profileId, {
            name: formName,
            artDirection: formArtDirection,
            referenceImageIds: formReferenceIds,
            voiceFile: formVoiceFile,
            removeVoiceSample: !formVoiceFile && !formKeepExistingVoice,
          });
          if (!saved) return;
        }

        await onGenerateCharacterSheet(profileId, {
          referenceImageIds: formReferenceIds,
        });
      } finally {
        setGeneratingCharSheet(false);
      }
    },
    [],
  );

  return { generatingCharSheet, generateSheetFromForm };
}
