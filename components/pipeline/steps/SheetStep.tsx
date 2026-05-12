"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type SheetStepProps = {
  busy: boolean;
  sheetUrl: string;
  sheetSource: "generated" | "uploaded";
  onStartVideo: () => void;
  onRegenerate: () => void;
};

export function SheetStep({
  busy,
  sheetUrl,
  sheetSource,
  onStartVideo,
  onRegenerate,
}: SheetStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            3
          </div>
          <CardTitle className="text-xl">Review Character Sheet</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sheetUrl}
            alt="Character sheet reference"
            className="max-h-[400px] w-full object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            disabled={busy}
            onClick={onStartVideo}
            className="rounded-full px-6"
          >
            {busy ? (
              <>
                <Spinner className="mr-2 h-4 w-4" /> Starting Video...
              </>
            ) : (
              "Generate 15s Video"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onRegenerate}
            className="rounded-full"
          >
            {sheetSource === "uploaded" ? "Replace Reference" : "Regenerate Image"}
          </Button>
        </div>

        <p className="text-xs text-zinc-500">
          Video generation uses Atlas Cloud Seedance reference-to-video (async).
        </p>
      </CardContent>
    </Card>
  );
}
