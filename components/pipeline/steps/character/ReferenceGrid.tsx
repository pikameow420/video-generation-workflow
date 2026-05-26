"use client";

import type { ReferenceImage } from "@/components/pipeline/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/** Reference thumbnail grid used by profile form (by id) and run picker (by url). */
export function ReferenceGrid({
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
