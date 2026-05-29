"use client";

import type { ReferenceImage } from "@/components/pipeline/types";
import { ImagePreviewDialog } from "@/components/ui/image-preview-dialog";
import { OverlayIconButton } from "@/components/ui/overlay-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useImagePreview } from "@/hooks/useImagePreview";
import { Maximize2, X } from "lucide-react";

export function ReferenceGrid({
  busy,
  loading = false,
  referenceImages,
  isSelected,
  onToggle,
  onDelete,
}: {
  busy: boolean;
  loading?: boolean;
  referenceImages: ReferenceImage[];
  isSelected: (item: ReferenceImage) => boolean;
  onToggle: (item: ReferenceImage) => void;
  onDelete?: (item: ReferenceImage) => void;
}) {
  const imagePreview = useImagePreview();

  if (loading && !referenceImages.length) {
    return <p className="text-xs text-zinc-500">Loading reference library…</p>;
  }
  if (!referenceImages.length) {
    return (
      <p className="text-xs text-zinc-500">
        No reference images yet—upload one to get started.
      </p>
    );
  }
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        {referenceImages.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group relative overflow-hidden rounded-lg border transition",
              isSelected(item)
                ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full flex-col items-stretch gap-0 rounded-none p-0 text-left font-normal hover:bg-transparent"
              onClick={() => onToggle(item)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.originalName}
                loading="lazy"
                decoding="async"
                className="h-24 w-full object-cover"
              />
              <span className="block truncate px-2 py-1 text-xs font-normal text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                {isSelected(item) ? "Selected - " : ""}
                {item.originalName}
              </span>
            </Button>
            <OverlayIconButton
              position="left"
              disabled={busy}
              aria-label={`View full size: ${item.originalName}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                imagePreview.open({
                  src: item.url,
                  alt: item.originalName,
                  title: item.originalName,
                });
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </OverlayIconButton>
            {onDelete ? (
              <OverlayIconButton
                disabled={busy}
                aria-label={`Delete ${item.originalName} from library`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(item);
                }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </OverlayIconButton>
            ) : null}
          </div>
        ))}
      </div>
      <ImagePreviewDialog preview={imagePreview.preview} onClose={imagePreview.close} />
    </>
  );
}
