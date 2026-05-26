"use client";

import type { ChangeEvent } from "react";

import type { CharacterProfile, ReferenceImage } from "@/components/pipeline/types";
import { ReferenceLibraryPicker } from "@/components/pipeline/steps/character/ReferenceLibraryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export type CharacterRunSetupProps = {
  busy: boolean;
  artDirection: string;
  onArtDirectionChange: (v: string) => void;
  referenceImages: ReferenceImage[];
  selectedReferenceUrls: string[];
  loadingReferenceImages: boolean;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => void;
  onRefreshReferences: () => void;
  onToggleReferenceUrl: (url: string) => void;
  onDeleteReferenceImage: (item: ReferenceImage) => void;
  useProfileVoice: boolean;
  onUseProfileVoiceChange: (next: boolean) => void;
  selectedProfile: CharacterProfile | null;
  onUseSelectedReferenceDirectly: () => void;
  onGenerateSheet: () => void;
  onReuseProfileSheet: () => void;
};

export function CharacterRunSetup({
  busy,
  artDirection,
  onArtDirectionChange,
  referenceImages,
  selectedReferenceUrls,
  loadingReferenceImages,
  onUploadReference,
  onRefreshReferences,
  onToggleReferenceUrl,
  onDeleteReferenceImage,
  useProfileVoice,
  onUseProfileVoiceChange,
  selectedProfile,
  onUseSelectedReferenceDirectly,
  onGenerateSheet,
  onReuseProfileSheet,
}: CharacterRunSetupProps) {
  return (
    <>
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          This run
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="art-direction-input">
            Visual style (optional)
          </Label>
          <Input
            id="art-direction-input"
            value={artDirection}
            onChange={(e) => onArtDirectionChange(e.target.value)}
            placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
          />
          <p className="text-xs text-zinc-500">
            Shapes how your visual sheet is drawn (separate from video export).
          </p>
        </div>
        <div className="space-y-2">
          <Label>Reference images for this run</Label>
          <p className="text-xs text-zinc-500">
            These guide the visual sheet in the next step. The final video uses that
            sheet, not the raw photos.
          </p>
          <ReferenceLibraryPicker
            busy={busy}
            referenceImages={referenceImages}
            loadingReferenceImages={loadingReferenceImages}
            onUploadReference={onUploadReference}
            onRefreshReferences={onRefreshReferences}
            isSelected={(item) => selectedReferenceUrls.includes(item.url)}
            onToggle={(item) => onToggleReferenceUrl(item.url)}
            onDelete={onDeleteReferenceImage}
          />
          {selectedReferenceUrls.length ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                Selected for this run (tap to remove):
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
                      onClick={() => onToggleReferenceUrl(url)}
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
              Skip sheet — use photo for video
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
            Attach profile voice (
            {selectedProfile.voiceSample.originalName}) for HD video export
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
              <Spinner className="mr-2 h-4 w-4" /> Building visual sheet…
            </>
          ) : (
            "Generate visual sheet"
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
            Use saved sheet
          </Button>
        ) : null}
      </div>
    </>
  );
}
