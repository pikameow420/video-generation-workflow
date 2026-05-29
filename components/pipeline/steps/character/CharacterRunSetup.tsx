"use client";

import type { CharacterProfile, ReferenceImage } from "@/components/pipeline/types";
import { ReferenceLibraryPicker } from "@/components/pipeline/steps/character/ReferenceLibraryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Mic } from "lucide-react";
import type { ChangeEvent } from "react";

export type CharacterRunSetupProps = {
  busy: boolean;
  generatingFrameSheet: boolean;
  artDirection: string;
  onArtDirectionChange: (v: string) => void;
  selectedProfiles: CharacterProfile[];
  generateBlockedReason: string | null;
  onGenerateSheet: () => void;
  onReuseProfileSheet: () => void;
  referenceImages: ReferenceImage[];
  loadingReferenceImages: boolean;
  referenceLibraryBusy: boolean;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => Promise<unknown>;
  maxFrameSheetExtras: number;
  frameSheetExtraReferenceUrls: string[];
  isFrameSheetExtraReferenceSelected: (item: ReferenceImage) => boolean;
  onToggleFrameSheetExtraReference: (item: ReferenceImage) => void;
};

export function CharacterRunSetup({
  busy,
  generatingFrameSheet,
  artDirection,
  onArtDirectionChange,
  selectedProfiles,
  generateBlockedReason,
  onGenerateSheet,
  onReuseProfileSheet,
  referenceImages,
  loadingReferenceImages,
  referenceLibraryBusy,
  onUploadReference,
  maxFrameSheetExtras,
  frameSheetExtraReferenceUrls,
  isFrameSheetExtraReferenceSelected,
  onToggleFrameSheetExtraReference,
}: CharacterRunSetupProps) {
  const hasSavedFrameSheet = selectedProfiles.some((p) => p.sheetUrl);
  const pickerDisabled =
    busy || generatingFrameSheet || maxFrameSheetExtras === 0;

  return (
    <>
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          This Run
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="art-direction-input">
            Art Direction for Frame Sheet (Optional)
          </Label>
          <Input
            id="art-direction-input"
            value={artDirection}
            onChange={(e) => onArtDirectionChange(e.target.value)}
            placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
          />
          <p className="text-xs text-zinc-500">
            Applies to the script-driven frame sequence sheet. Edit here, then
            generate again after changing settings.
          </p>
        </div>

        {selectedProfiles.length ? (
          <div className="space-y-2">
            <Label>Characters in this run ({selectedProfiles.length})</Label>
            <ul className="space-y-2 text-sm">
              {selectedProfiles.map((profile) => (
                <li
                  key={profile.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/50"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {profile.name}
                  </span>
                  {profile.muapiCharacterSheetUrl ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      character sheet
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      missing character sheet
                    </span>
                  )}
                  {profile.voiceSample ? (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Mic className="h-3 w-3" aria-hidden /> voice
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      missing voice
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500">
              Select up to 3 profiles. Each needs a character sheet and voice sample
              before generating the frame sheet or video.
            </p>
          </div>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Select one or more character profiles above to continue.
          </p>
        )}

        {selectedProfiles.length > 0 && maxFrameSheetExtras > 0 ? (
          <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <Label>Extra references for frame sheet (optional)</Label>
            <p className="text-xs text-zinc-500">
              Character sheets are included automatically. Pick up to{" "}
              {maxFrameSheetExtras} more library image
              {maxFrameSheetExtras === 1 ? "" : "s"} to steer style or scene
              details.
            </p>
            <ReferenceLibraryPicker
              busy={referenceLibraryBusy}
              disabled={pickerDisabled}
              referenceImages={referenceImages}
              loadingReferenceImages={loadingReferenceImages}
              onUploadReference={onUploadReference}
              isSelected={isFrameSheetExtraReferenceSelected}
              onToggle={onToggleFrameSheetExtraReference}
              selectedCount={frameSheetExtraReferenceUrls.length}
            />
          </div>
        ) : selectedProfiles.length > 0 && maxFrameSheetExtras === 0 ? (
          <p className="text-xs text-zinc-500 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            All 9 reference slots are used by character sheets; remove a character
            or use fewer profiles to add extra library images.
          </p>
        ) : null}

        {selectedProfiles.length > 0 && generateBlockedReason ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {generateBlockedReason}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          type="button"
          disabled={busy || generatingFrameSheet || Boolean(generateBlockedReason)}
          onClick={onGenerateSheet}
          className="rounded-full px-6"
        >
          {generatingFrameSheet ? (
            <>
              <Spinner className="mr-2 h-4 w-4" /> Generating frame sheet...
            </>
          ) : (
            "Generate Frame Sequence Sheet"
          )}
        </Button>
        {hasSavedFrameSheet ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy || generatingFrameSheet}
            onClick={onReuseProfileSheet}
            className="rounded-full"
          >
            Reuse Saved Frame Sheet
          </Button>
        ) : null}
      </div>
    </>
  );
}
