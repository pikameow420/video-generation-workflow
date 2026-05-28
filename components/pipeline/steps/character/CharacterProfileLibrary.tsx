"use client";

import { ChangeEvent, useState } from "react";

import { CharacterProfileForm } from "@/components/pipeline/steps/character/CharacterProfileForm";
import type { CharacterProfile, ReferenceImage } from "@/components/pipeline/types";
import type {
  CreateCharacterProfilePayload,
  UpdateCharacterProfilePayload,
} from "@/hooks/useCharacterProfiles";
import { cn } from "@/lib/utils";
import { Mic, Pencil, Plus, X } from "lucide-react";

export type CharacterProfileLibraryProps = {
  busy: boolean;
  referenceLibraryBusy?: boolean;
  profiles: CharacterProfile[];
  loadingProfiles: boolean;
  isProfileSelectedForRun: (profileId: string) => boolean;
  runCharacterCount: number;
  staleRunSelection?: boolean;
  referenceImages: ReferenceImage[];
  loadingReferenceImages: boolean;
  onToggleRunProfile: (profile: CharacterProfile) => void;
  onDeleteProfile: (profile: CharacterProfile) => void;
  onCreateProfile: (input: CreateCharacterProfilePayload) => Promise<boolean>;
  onUpdateProfile: (
    id: string,
    input: UpdateCharacterProfilePayload,
  ) => Promise<boolean>;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => Promise<ReferenceImage | null>;
  onDeleteReference: (item: ReferenceImage) => void;
  onGenerateMuapiCharacterSheet: (
    profileId: string,
    options?: { referenceImageIds: string[] },
  ) => Promise<unknown>;
};

export function CharacterProfileLibrary({
  busy,
  referenceLibraryBusy = false,
  profiles,
  loadingProfiles,
  isProfileSelectedForRun,
  runCharacterCount,
  staleRunSelection = false,
  referenceImages,
  loadingReferenceImages,
  onToggleRunProfile,
  onDeleteProfile,
  onCreateProfile,
  onUpdateProfile,
  onUploadReference,
  onDeleteReference,
  onGenerateMuapiCharacterSheet,
}: CharacterProfileLibraryProps) {
  const [formTarget, setFormTarget] = useState<"new" | string | null>(null);

  const closeForm = () => setFormTarget(null);
  const openCreateForm = () => setFormTarget("new");
  const openEditForm = (profile: CharacterProfile) => setFormTarget(profile.id);

  return (
    <>
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your Character Profiles
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((profile) => {
            const isSelected = isProfileSelectedForRun(profile.id);
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
                  onClick={() => onToggleRunProfile(profile)}
                  className="block w-full text-left"
                >
                  <span className="block truncate pr-8 font-semibold text-zinc-900 dark:text-zinc-100">
                    {isSelected ? "In run — " : ""}
                    {profile.name}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span>
                      {profile.referenceImages.length} reference
                      {profile.referenceImages.length === 1 ? "" : "s"}
                    </span>
                    {profile.muapiCharacterSheetUrl ? (
                      <span>character sheet</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        no character sheet
                      </span>
                    )}
                    {profile.voiceSample ? (
                      <span className="inline-flex items-center gap-1">
                        <Mic className="h-3 w-3" aria-hidden /> voice
                      </span>
                    ) : null}
                    {profile.sheetUrl ? <span>saved frame sheet</span> : null}
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
            onClick={() =>
              formTarget === "new" ? closeForm() : openCreateForm()
            }
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
        {staleRunSelection ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This run references a profile that could not be found. It may have
            been deleted—deselect it or create a new profile below.
          </p>
        ) : loadingProfiles && !profiles.length ? (
          <p className="text-xs text-zinc-500">Loading character profiles…</p>
        ) : !profiles.length && !loadingProfiles ? (
          <p className="text-xs text-zinc-500">
            No character profiles yet. Create one to reuse references, art
            direction, and voice in one click next run.
          </p>
        ) : null}
        {runCharacterCount > 0 && !staleRunSelection ? (
          <p className="text-xs text-zinc-500">
            {runCharacterCount} profile{runCharacterCount === 1 ? "" : "s"} selected
            for this run (max 3).
          </p>
        ) : runCharacterCount === 0 ? (
          <p className="text-xs text-zinc-500">
            Select profiles to include in this run.
          </p>
        ) : null}
      </div>

      {formTarget !== null ? (
        <CharacterProfileForm
          key={formTarget}
          busy={busy || referenceLibraryBusy}
          formTarget={formTarget}
          profiles={profiles}
          referenceImages={referenceImages}
          loadingReferenceImages={loadingReferenceImages}
          onUploadReference={onUploadReference}
          onDeleteReference={onDeleteReference}
          onCreateProfile={onCreateProfile}
          onUpdateProfile={onUpdateProfile}
          onGenerateMuapiCharacterSheet={onGenerateMuapiCharacterSheet}
          onClose={closeForm}
        />
      ) : null}
    </>
  );
}
