"use client";

import type { ChangeEvent } from "react";

import type { ReferenceImage } from "@/components/pipeline/types";
import { ReferenceGrid } from "./ReferenceGrid";

export type ReferenceLibraryPickerProps = {
  busy: boolean;
  referenceImages: ReferenceImage[];
  loadingReferenceImages: boolean;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => Promise<unknown>;
  isSelected: (item: ReferenceImage) => boolean;
  onToggle: (item: ReferenceImage) => void;
  onDelete?: (item: ReferenceImage) => void;
  disabled?: boolean;
  selectedCount?: number;
};

export function ReferenceLibraryPicker({
  busy,
  referenceImages,
  loadingReferenceImages,
  onUploadReference,
  isSelected,
  onToggle,
  onDelete,
  disabled = false,
  selectedCount,
}: ReferenceLibraryPickerProps) {
  const pickerBusy = busy || disabled;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
          Upload Reference
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onUploadReference}
            disabled={pickerBusy}
          />
        </label>
        {selectedCount !== undefined ? (
          <span className="text-xs text-zinc-500">{selectedCount} selected</span>
        ) : null}
      </div>
      <ReferenceGrid
        busy={pickerBusy}
        loading={loadingReferenceImages}
        referenceImages={referenceImages}
        isSelected={isSelected}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    </>
  );
}
