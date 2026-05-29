"use client";

import type { ImagePreview } from "@/hooks/useImagePreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ZoomIn } from "lucide-react";

type PreviewableImageProps = {
  src: string;
  alt: string;
  onPreview: (preview: ImagePreview) => void;
  previewTitle?: string;
  className?: string;
  imageClassName?: string;
};

/** Clickable image that opens a full-size preview via useImagePreview + ImagePreviewDialog. */
export function PreviewableImage({
  src,
  alt,
  onPreview,
  previewTitle,
  className,
  imageClassName,
}: PreviewableImageProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "group relative block h-auto w-full cursor-zoom-in overflow-hidden rounded-xl p-0 text-left",
        className,
      )}
      onClick={() =>
        onPreview({
          src,
          alt,
          title: previewTitle ?? alt,
        })
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={cn("w-full", imageClassName)} />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center",
          "bg-black/0 transition group-hover:bg-black/20",
        )}
        aria-hidden
      >
        <ZoomIn className="size-8 text-white opacity-0 drop-shadow-md transition group-hover:opacity-100" />
      </span>
    </Button>
  );
}
