"use client";

import { ChangeEvent, useState } from "react";

import type { CharacterProfile, ReferenceImage } from "@/components/pipeline/types";
import { ReferenceLibraryPicker } from "./ReferenceLibraryPicker";
import type {
  CreateCharacterProfilePayload,
  UpdateCharacterProfilePayload,
} from "@/hooks/useCharacterProfiles";
import { useProfileSheetGeneration } from "@/hooks/useProfileSheetGeneration";
import { Button } from "@/components/ui/button";
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewableImage } from "@/components/ui/previewable-image";
import { Spinner } from "@/components/ui/spinner";
import { useImagePreview } from "@/hooks/useImagePreview";
import { Mic } from "lucide-react";

function initialProfileFields(
  formTarget: "new" | string,
  profiles: CharacterProfile[],
) {
  if (formTarget === "new") {
    return {
      formName: "",
      formArtDirection: "",
      formReferenceIds: [] as string[],
      formVoiceFile: null as File | null,
      formKeepExistingVoice: true,
    };
  }

  const profile = profiles.find((item) => item.id === formTarget);
  if (!profile) {
    return {
      formName: "",
      formArtDirection: "",
      formReferenceIds: [] as string[],
      formVoiceFile: null as File | null,
      formKeepExistingVoice: true,
    };
  }

  return {
    formName: profile.name,
    formArtDirection: profile.artDirection,
    formReferenceIds: profile.referenceImages.map((item) => item.id),
    formVoiceFile: null as File | null,
    formKeepExistingVoice: true,
  };
}

export type CharacterProfileFormProps = {
  busy: boolean;
  formTarget: "new" | string;
  profiles: CharacterProfile[];
  referenceImages: ReferenceImage[];
  loadingReferenceImages: boolean;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => Promise<ReferenceImage | null>;
  onDeleteReference: (item: ReferenceImage) => void;
  onCreateProfile: (input: CreateCharacterProfilePayload) => Promise<boolean>;
  onUpdateProfile: (
    id: string,
    input: UpdateCharacterProfilePayload,
  ) => Promise<boolean>;
  onGenerateMuapiCharacterSheet: (
    profileId: string,
    options?: { referenceImageIds: string[] },
  ) => Promise<unknown>;
  onClose: () => void;
};

export function CharacterProfileForm({
  busy,
  formTarget,
  profiles,
  referenceImages,
  loadingReferenceImages,
  onUploadReference,
  onDeleteReference,
  onCreateProfile,
  onUpdateProfile,
  onGenerateMuapiCharacterSheet,
  onClose,
}: CharacterProfileFormProps) {
  const editingProfile =
    formTarget !== "new"
      ? profiles.find((item) => item.id === formTarget) ?? null
      : null;

  const [fields, setFields] = useState(() =>
    initialProfileFields(formTarget, profiles),
  );
  const { formName, formArtDirection, formReferenceIds, formVoiceFile, formKeepExistingVoice } =
    fields;
  const [savingProfile, setSavingProfile] = useState(false);
  const { generatingCharSheet, generateSheetFromForm } = useProfileSheetGeneration();
  const imagePreview = useImagePreview();

  const existingVoiceName =
    formKeepExistingVoice && !formVoiceFile
      ? editingProfile?.voiceSample?.originalName ?? null
      : null;

  const toggleFormReference = (item: ReferenceImage) => {
    setFields((prev) => ({
      ...prev,
      formReferenceIds: prev.formReferenceIds.includes(item.id)
        ? prev.formReferenceIds.filter((id) => id !== item.id)
        : [...prev.formReferenceIds, item.id].slice(0, 9),
    }));
  };

  const handleUploadReference = async (e: ChangeEvent<HTMLInputElement>) => {
    const uploaded = await onUploadReference(e);
    if (!uploaded) return;
    setFields((prev) => {
      if (prev.formReferenceIds.includes(uploaded.id)) return prev;
      return {
        ...prev,
        formReferenceIds: [...prev.formReferenceIds, uploaded.id].slice(0, 9),
      };
    });
  };

  const handleDeleteReference = (item: ReferenceImage) => {
    setFields((prev) => ({
      ...prev,
      formReferenceIds: prev.formReferenceIds.filter((id) => id !== item.id),
    }));
    void onDeleteReference(item);
  };

  const onVoiceFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    if (file) setFields((prev) => ({ ...prev, formVoiceFile: file }));
  };

  const onSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const base = {
        name: formName,
        artDirection: formArtDirection,
        referenceImageIds: formReferenceIds,
        voiceFile: formVoiceFile,
      };
      const ok = editingProfile
        ? await onUpdateProfile(editingProfile.id, {
            ...base,
            removeVoiceSample: !formVoiceFile && !formKeepExistingVoice,
          })
        : await onCreateProfile(base);
      if (ok) onClose();
    } finally {
      setSavingProfile(false);
    }
  };

  const canSubmitForm =
    formName.trim().length > 0 && formReferenceIds.length > 0;
  const formBusy = busy || savingProfile;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {editingProfile
          ? `Edit Character Profile for ${editingProfile.name}`
          : "New Character Profile"}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="profile-form-name">Name</Label>
        <Input
          id="profile-form-name"
          value={formName}
          onChange={(e) =>
            setFields((prev) => ({ ...prev, formName: e.target.value }))
          }
          placeholder="e.g. Bolt the Mascot"
          disabled={formBusy}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-form-art-direction">
          Art Direction (Optional)
        </Label>
        <Input
          id="profile-form-art-direction"
          value={formArtDirection}
          onChange={(e) =>
            setFields((prev) => ({
              ...prev,
              formArtDirection: e.target.value,
            }))
          }
          placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
          disabled={formBusy}
        />
      </div>
      <div className="space-y-2">
        <Label>Anchor Reference Photos (pick at least 1)</Label>
        <ReferenceLibraryPicker
          busy={busy}
          disabled={savingProfile}
          referenceImages={referenceImages}
          loadingReferenceImages={loadingReferenceImages}
          onUploadReference={handleUploadReference}
          isSelected={(item) => formReferenceIds.includes(item.id)}
          onToggle={toggleFormReference}
          onDelete={handleDeleteReference}
          selectedCount={formReferenceIds.length}
        />
        {!formReferenceIds.length ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Select at least one reference image to anchor this character.
          </p>
        ) : null}
      </div>
      {editingProfile ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <Label>Character sheet</Label>
          <p className="text-xs text-zinc-500">
            Built from your anchor photos. Generate before using this profile in a
            run.
          </p>
          {editingProfile.muapiCharacterSheetUrl ? (
            <div className="flex flex-wrap items-start gap-3">
              <PreviewableImage
                src={editingProfile.muapiCharacterSheetUrl}
                alt={`Character sheet for ${editingProfile.name}`}
                previewTitle={`Character sheet for ${editingProfile.name}`}
                onPreview={imagePreview.open}
                className="max-w-xs rounded-md border dark:border-zinc-700"
                imageClassName="max-h-32 object-contain"
              />
              {editingProfile.muapiCharacterSheetUpdatedAt ? (
                <p className="text-xs text-zinc-500">
                  Updated{" "}
                  {new Date(
                    editingProfile.muapiCharacterSheetUpdatedAt,
                  ).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Not generated yet.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={formBusy || generatingCharSheet || !formReferenceIds.length}
            onClick={() => {
              void generateSheetFromForm({
                profileId: editingProfile.id,
                formName,
                formArtDirection,
                formReferenceIds,
                formVoiceFile,
                formKeepExistingVoice,
                editingProfile,
                onUpdateProfile,
                onGenerateMuapiCharacterSheet,
              });
            }}
          >
            {generatingCharSheet ? (
              <>
                <Spinner className="mr-2 h-3 w-3" />
                Generating...
              </>
            ) : editingProfile.muapiCharacterSheetUrl ? (
              "Regenerate Character Sheet"
            ) : (
              "Generate Character Sheet"
            )}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Save the profile first, then generate the character sheet here.
        </p>
      )}

      <div className="space-y-2">
        <Label>Voice Sample</Label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900">
            <input
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
              className="sr-only"
              disabled={formBusy}
              onChange={onVoiceFileChange}
            />
            {formVoiceFile || existingVoiceName
              ? "Replace voice sample"
              : "Add voice sample"}
          </label>
          {formVoiceFile ? (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <Mic className="h-3 w-3" aria-hidden /> {formVoiceFile.name} (new)
              <Button
                type="button"
                variant="link"
                size="xs"
                aria-label="Remove voice sample"
                className="ml-1 h-auto min-h-0 p-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() =>
                  setFields((prev) => ({ ...prev, formVoiceFile: null }))
                }
              >
                ×
              </Button>
            </span>
          ) : existingVoiceName ? (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <Mic className="h-3 w-3" aria-hidden /> {existingVoiceName}{" "}
              (current)
              <Button
                type="button"
                variant="link"
                size="xs"
                aria-label="Remove current voice sample"
                className="ml-1 h-auto min-h-0 p-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() =>
                  setFields((prev) => ({
                    ...prev,
                    formKeepExistingVoice: false,
                  }))
                }
              >
                ×
              </Button>
            </span>
          ) : editingProfile?.voiceSample && !formKeepExistingVoice ? (
            <span className="text-xs text-zinc-500">
              Current voice sample will be removed on save.{" "}
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto min-h-0 p-0 underline"
                onClick={() =>
                  setFields((prev) => ({
                    ...prev,
                    formKeepExistingVoice: true,
                  }))
                }
              >
                Undo
              </Button>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          className="rounded-full px-6"
          disabled={formBusy || !canSubmitForm}
          onClick={() => void onSaveProfile()}
        >
          {savingProfile ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />{" "}
              {editingProfile ? "Saving..." : "Creating..."}
            </>
          ) : editingProfile ? (
            "Save Changes"
          ) : (
            "Create Profile"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          disabled={formBusy}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>

      <ImagePreviewDialog preview={imagePreview.preview} onClose={imagePreview.close} />
    </div>
  );
}
