"use client";

import { ChangeEvent, useState } from "react";

import type {
  CharacterProfile,
  ReferenceImage,
} from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Mic, Pencil, Plus, X } from "lucide-react";

export type CreateCharacterProfileFormInput = {
  name: string;
  artDirection: string;
  referenceImageIds: string[];
  voiceFile: File | null;
};

export type UpdateCharacterProfileFormInput = CreateCharacterProfileFormInput & {
  removeVoiceSample: boolean;
};

type CharacterStepProps = {
  busy: boolean;
  profiles: CharacterProfile[];
  loadingProfiles: boolean;
  selectedProfileId: string | null;
  selectedProfile: CharacterProfile | null;
  artDirection: string;
  referenceImages: ReferenceImage[];
  selectedReferenceUrls: string[];
  loadingReferenceImages: boolean;
  useProfileVoice: boolean;
  onSelectProfile: (id: string | null) => void;
  onDeleteProfile: (profile: CharacterProfile) => void;
  onRefreshProfiles: () => void;
  onCreateProfile: (input: CreateCharacterProfileFormInput) => Promise<boolean>;
  onUpdateProfile: (
    id: string,
    input: UpdateCharacterProfileFormInput,
  ) => Promise<boolean>;
  onArtDirectionChange: (v: string) => void;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => void;
  onRefreshReferences: () => void;
  onSelectReferenceImage: (url: string) => void;
  onRemoveReferenceImage: (url: string) => void;
  onDeleteReferenceImage: (item: ReferenceImage) => void;
  onUseProfileVoiceChange: (next: boolean) => void;
  onUseSelectedReferenceDirectly: () => void;
  onReuseProfileSheet: () => void;
  onGenerateSheet: () => void;
};

/** Reference thumbnail grid used by both the create form (by id) and the run picker (by url). */
function ReferenceGrid({
  busy,
  referenceImages,
  isSelected,
  onToggle,
  onDelete,
}: {
  busy: boolean;
  referenceImages: ReferenceImage[];
  isSelected: (item: ReferenceImage) => boolean;
  onToggle: (item: ReferenceImage) => void;
  onDelete?: (item: ReferenceImage) => void;
}) {
  if (!referenceImages.length) {
    return (
      <p className="text-xs text-zinc-500">
        No saved references yet. Upload one to use it here.
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {referenceImages.slice(0, 6).map((item) => (
        <div
          key={item.id}
          className={cn(
            "group relative overflow-hidden rounded-lg border transition",
            isSelected(item)
              ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
              : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600",
          )}
        >
          <button
            type="button"
            onClick={() => onToggle(item)}
            className="w-full text-left transition hover:border-zinc-400 dark:hover:border-zinc-600"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.originalName}
              className="h-24 w-full object-cover"
            />
            <span className="block truncate px-2 py-1 text-xs text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
              {isSelected(item) ? "Selected - " : ""}
              {item.originalName}
            </span>
          </button>
          {onDelete ? (
            <button
              type="button"
              disabled={busy}
              aria-label={`Delete ${item.originalName} from library`}
              className={cn(
                "absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full",
                "bg-black/60 text-white shadow-sm transition-opacity hover:bg-black/80",
                "pointer-events-none opacity-0",
                "focus-visible:pointer-events-auto focus-visible:opacity-100",
                "group-hover:pointer-events-auto group-hover:opacity-100",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(item);
              }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function CharacterStep({
  busy,
  profiles,
  loadingProfiles,
  selectedProfileId,
  selectedProfile,
  artDirection,
  referenceImages,
  selectedReferenceUrls,
  loadingReferenceImages,
  useProfileVoice,
  onSelectProfile,
  onDeleteProfile,
  onRefreshProfiles,
  onCreateProfile,
  onUpdateProfile,
  onArtDirectionChange,
  onUploadReference,
  onRefreshReferences,
  onSelectReferenceImage,
  onRemoveReferenceImage,
  onDeleteReferenceImage,
  onUseProfileVoiceChange,
  onUseSelectedReferenceDirectly,
  onReuseProfileSheet,
  onGenerateSheet,
}: CharacterStepProps) {
  /** null = form closed, "new" = creating, otherwise the id of the profile being edited. */
  const [formTarget, setFormTarget] = useState<"new" | string | null>(null);
  const [formName, setFormName] = useState("");
  const [formArtDirection, setFormArtDirection] = useState("");
  const [formReferenceIds, setFormReferenceIds] = useState<string[]>([]);
  const [formVoiceFile, setFormVoiceFile] = useState<File | null>(null);
  const [formKeepExistingVoice, setFormKeepExistingVoice] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const isFormOpen = formTarget !== null;
  const editingProfile =
    formTarget && formTarget !== "new"
      ? profiles.find((item) => item.id === formTarget) ?? null
      : null;
  const existingVoiceName =
    formKeepExistingVoice && !formVoiceFile
      ? editingProfile?.voiceSample?.originalName ?? null
      : null;

  const toggleFormReference = (item: ReferenceImage) => {
    setFormReferenceIds((prev) =>
      prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id].slice(0, 9),
    );
  };

  const onVoiceFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.currentTarget.value = "";
    if (file) setFormVoiceFile(file);
  };

  const closeForm = () => {
    setFormTarget(null);
    setFormName("");
    setFormArtDirection("");
    setFormReferenceIds([]);
    setFormVoiceFile(null);
    setFormKeepExistingVoice(true);
  };

  const openCreateForm = () => {
    setFormTarget("new");
    setFormName("");
    setFormArtDirection("");
    setFormReferenceIds([]);
    setFormVoiceFile(null);
    setFormKeepExistingVoice(true);
  };

  const openEditForm = (profile: CharacterProfile) => {
    setFormTarget(profile.id);
    setFormName(profile.name);
    setFormArtDirection(profile.artDirection);
    setFormReferenceIds(profile.referenceImages.map((item) => item.id));
    setFormVoiceFile(null);
    setFormKeepExistingVoice(true);
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
      if (ok) closeForm();
    } finally {
      setSavingProfile(false);
    }
  };

  const canSubmitForm =
    formName.trim().length > 0 && formReferenceIds.length > 0;

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            3
          </div>
          <CardTitle className="text-xl">Pick or create a character</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Your Character Profiles
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshProfiles}
              disabled={busy || loadingProfiles}
              className="rounded-full"
            >
              {loadingProfiles ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles.map((profile) => {
              const isSelected = selectedProfileId === profile.id;
              return (
                <div
                  key={profile.id}
                  className={cn(
                    "group relative rounded-xl border p-3 text-left text-sm transition-all",
                    isSelected
                      ? "border-zinc-900 bg-white ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectProfile(isSelected ? null : profile.id)}
                    className="block w-full text-left"
                  >
                    <span className="block truncate pr-8 font-semibold text-zinc-900 dark:text-zinc-100">
                      {isSelected ? "Selected - " : ""}
                      {profile.name}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>
                        {profile.referenceImages.length} reference
                        {profile.referenceImages.length === 1 ? "" : "s"}
                      </span>
                      {profile.voiceSample ? (
                        <span className="inline-flex items-center gap-1">
                          <Mic className="h-3 w-3" aria-hidden /> voice
                        </span>
                      ) : null}
                      {profile.sheetUrl ? <span>saved sheet</span> : null}
                    </span>
                    {profile.referenceImages.length ? (
                      <span className="mt-2 flex gap-1.5">
                        {profile.referenceImages.slice(0, 4).map((ref) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={ref.id}
                            src={ref.url}
                            alt={ref.originalName}
                            className="h-10 w-10 rounded-md border object-cover dark:border-zinc-800"
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                  <span
                    className={cn(
                      "absolute right-2 top-2 z-10 flex items-center gap-1.5",
                      "pointer-events-none opacity-0 transition-opacity",
                      "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                      "group-hover:pointer-events-auto group-hover:opacity-100",
                    )}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Edit profile ${profile.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-sm hover:bg-black/80 disabled:pointer-events-none disabled:opacity-40"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditForm(profile);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Delete profile ${profile.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-sm hover:bg-black/80 disabled:pointer-events-none disabled:opacity-40"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteProfile(profile);
                      }}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                    </button>
                  </span>
                </div>
              );
            })}
            <button
              type="button"
              disabled={busy}
              onClick={() => (formTarget === "new" ? closeForm() : openCreateForm())}
              className={cn(
                "flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-sm font-medium transition-all",
                formTarget === "new"
                  ? "border-zinc-900 bg-white text-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-100"
                  : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/40",
              )}
            >
              <Plus className="h-5 w-5" aria-hidden />
              {formTarget === "new" ? "Close" : "New Profile"}
            </button>
          </div>
          {!profiles.length && !loadingProfiles ? (
            <p className="text-xs text-zinc-500">
              No character profiles yet. Create one to reuse references, art
              direction, and voice in one click next run.
            </p>
          ) : null}
          {selectedProfile ? (
            <p className="text-xs text-zinc-500">
              Using <span className="font-medium">{selectedProfile.name}</span> — its
              references, art direction, and voice are pre-filled in the run section
              below. You can still tweak them for this run.
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              No profile selected — this will be a one-off run.
            </p>
          )}
        </div>

        {isFormOpen ? (
          <div className="space-y-4 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/60">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {editingProfile
                ? `Edit Character Profile — ${editingProfile.name}`
                : "New Character Profile"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="profile-form-name">Name</Label>
              <Input
                id="profile-form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Bolt the Mascot"
                disabled={busy || savingProfile}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-form-art-direction">
                Art Direction (Optional)
              </Label>
              <Input
                id="profile-form-art-direction"
                value={formArtDirection}
                onChange={(e) => setFormArtDirection(e.target.value)}
                placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
                disabled={busy || savingProfile}
              />
            </div>
            <div className="space-y-2">
              <Label>Anchor Reference Photos (pick at least 1)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                  Upload Reference
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={onUploadReference}
                    disabled={busy || savingProfile}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRefreshReferences}
                  disabled={busy || savingProfile || loadingReferenceImages}
                  className="rounded-full"
                >
                  {loadingReferenceImages ? "Refreshing..." : "Refresh Library"}
                </Button>
                <span className="text-xs text-zinc-500">
                  {formReferenceIds.length} selected
                </span>
              </div>
              <ReferenceGrid
                busy={busy || savingProfile}
                referenceImages={referenceImages}
                isSelected={(item) => formReferenceIds.includes(item.id)}
                onToggle={toggleFormReference}
              />
              {!formReferenceIds.length ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Select at least one reference image to anchor this character.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Voice Sample (Optional, MP3/WAV)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900">
                  <input
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
                    className="sr-only"
                    disabled={busy || savingProfile}
                    onChange={onVoiceFileChange}
                  />
                  {formVoiceFile || existingVoiceName
                    ? "Replace voice sample"
                    : "Add voice sample"}
                </label>
                {formVoiceFile ? (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <Mic className="h-3 w-3" aria-hidden /> {formVoiceFile.name}{" "}
                    (new)
                    <button
                      type="button"
                      aria-label="Remove voice sample"
                      className="ml-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      onClick={() => setFormVoiceFile(null)}
                    >
                      ×
                    </button>
                  </span>
                ) : existingVoiceName ? (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <Mic className="h-3 w-3" aria-hidden /> {existingVoiceName}{" "}
                    (current)
                    <button
                      type="button"
                      aria-label="Remove current voice sample"
                      className="ml-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      onClick={() => setFormKeepExistingVoice(false)}
                    >
                      ×
                    </button>
                  </span>
                ) : editingProfile?.voiceSample && !formKeepExistingVoice ? (
                  <span className="text-xs text-zinc-500">
                    Current voice sample will be removed on save.{" "}
                    <button
                      type="button"
                      className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
                      onClick={() => setFormKeepExistingVoice(true)}
                    >
                      Undo
                    </button>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                className="rounded-full px-6"
                disabled={busy || savingProfile || !canSubmitForm}
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
                disabled={busy || savingProfile}
                onClick={closeForm}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            This Run
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="art-direction-input">
              Art Direction for Visuals (Optional)
            </Label>
            <Input
              id="art-direction-input"
              value={artDirection}
              onChange={(e) => onArtDirectionChange(e.target.value)}
              placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
            />
            <p className="text-xs text-zinc-500">
              Image generation is billed separately.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Reference Photos For This Run</Label>
            <p className="text-xs text-zinc-500">
              Selected references steer frame sequence sheet generation only. Video
              uses the sheet from the next step.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                Upload Reference
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={onUploadReference}
                  disabled={busy}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={onRefreshReferences}
                disabled={busy || loadingReferenceImages}
                className="rounded-full"
              >
                {loadingReferenceImages ? "Refreshing..." : "Refresh Library"}
              </Button>
            </div>
            <ReferenceGrid
              busy={busy}
              referenceImages={referenceImages}
              isSelected={(item) => selectedReferenceUrls.includes(item.url)}
              onToggle={(item) => onSelectReferenceImage(item.url)}
              onDelete={onDeleteReferenceImage}
            />
            {selectedReferenceUrls.length ? (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  Selected references (remove individually):
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedReferenceUrls.map((url) => {
                    const label =
                      referenceImages.find((item) => item.url === url)
                        ?.originalName ??
                      url.split("/").pop() ??
                      "reference";
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => onRemoveReferenceImage(url)}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <span className="max-w-[180px] truncate">{label}</span>
                        <span aria-hidden>×</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={onUseSelectedReferenceDirectly}
                disabled={busy || !selectedReferenceUrls.length}
                className="rounded-full"
              >
                Use Selected Reference For Video
              </Button>
              {selectedReferenceUrls.length ? (
                <span className="text-xs text-zinc-500">
                  {selectedReferenceUrls.length} reference
                  {selectedReferenceUrls.length > 1 ? "s" : ""} selected
                </span>
              ) : null}
            </div>
          </div>
          {selectedProfile?.voiceSample ? (
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={useProfileVoice}
                disabled={busy}
                onChange={(e) => onUseProfileVoiceChange(e.target.checked)}
              />
              Use this profile&apos;s voice sample (
              {selectedProfile.voiceSample.originalName}) as @audio1 in the video
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            disabled={busy}
            onClick={onGenerateSheet}
            className="rounded-full px-6"
          >
            {busy ? (
              <>
                <Spinner className="mr-2 h-4 w-4" /> Generating Art...
              </>
            ) : (
              "Generate Frame Sequence Sheet"
            )}
          </Button>
          {selectedProfile?.sheetUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onReuseProfileSheet}
              className="rounded-full"
            >
              Reuse Saved Sheet
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
