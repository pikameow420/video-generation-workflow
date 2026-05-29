"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog";
import { deleteJson } from "@/lib/api/client";

export function LibraryVideoCard({
  id,
  displayTitle,
  videoUrl,
  hasCaptions,
  updatedLabel,
  bytesLabel,
}: {
  id: string;
  displayTitle: string;
  videoUrl: string;
  hasCaptions: boolean;
  updatedLabel: string;
  bytesLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const performDelete = () => {
    startTransition(() => {
      void (async () => {
        try {
          await deleteJson(
            `/api/pipeline-videos?id=${encodeURIComponent(id)}`,
            "Could not remove video",
          );
          toast.success("Removed from library");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Remove failed");
        }
      })();
    });
  };

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
          <h2 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {displayTitle}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            disabled={pending}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {pending ? "…" : "Delete"}
          </Button>
        </div>
        <div className="aspect-[9/16] max-h-[min(60vh,480px)] bg-zinc-950">
          <video
            className="h-full w-full object-contain"
            controls
            playsInline
            preload="metadata"
            src={videoUrl}
          />
        </div>
        <div className="space-y-1 p-3 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-[11px] text-zinc-500">
              {id}
            </span>
            {hasCaptions ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                Captioned
              </span>
            ) : null}
          </div>
          <p>{updatedLabel}</p>
          <p>{bytesLabel}</p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Open in new tab
          </a>
        </div>
      </Card>

      <ConfirmAlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Remove from library?"
        description="This video will be hidden (marked deleted in the database; the file is not removed)."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          performDelete();
        }}
      />
    </>
  );
}
