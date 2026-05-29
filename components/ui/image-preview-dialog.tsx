"use client";

import type { ImagePreview } from "@/hooks/useImagePreview";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
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
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {preview ? (
          <>
            <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b py-3 pr-4 pl-4">
              <DialogTitle
                className={
                  preview.title
                    ? "min-w-0 flex-1 truncate text-left text-sm font-semibold"
                    : "sr-only"
                }
              >
                {title}
              </DialogTitle>
              <DialogDescription className="sr-only">{description}</DialogDescription>
              <DialogClose className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
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
