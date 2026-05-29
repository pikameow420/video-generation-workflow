"use client";

import type { ImagePreview } from "@/hooks/useImagePreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type ImagePreviewDialogProps = {
  preview: ImagePreview | null;
  onClose: () => void;
};

export function ImagePreviewDialog({ preview, onClose }: ImagePreviewDialogProps) {
  const title = preview?.title?.trim() || preview?.alt?.trim() || "Image preview";
  const description = preview?.alt?.trim() || "Full-size image preview";

  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-w-5xl">
        {preview ? (
          <>
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className={preview.title ? undefined : "sr-only"}>
                {title}
              </DialogTitle>
              <DialogDescription className="sr-only">{description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(100vh-6rem)]">
              <div className="flex items-center justify-center bg-zinc-100 p-4 dark:bg-zinc-900/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.src}
                  alt={preview.alt ?? "Preview"}
                  className="max-h-[calc(100vh-8rem)] w-auto max-w-full object-contain"
                />
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
