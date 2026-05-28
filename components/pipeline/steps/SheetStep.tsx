"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { VideoProvider } from "@/lib/schemas";

type SheetStepProps = {
  busy: boolean;
  sheetUrl: string;
  sheetSource: "generated" | "uploaded";
  videoProvider: VideoProvider;
  onVideoProviderChange: (next: VideoProvider) => void;
  videoProviderEnvLoaded: boolean;
  atlasConfigured: boolean;
  muapiConfigured: boolean;
  /** Whether the selected backend is configured on the server. */
  canStartVideo: boolean;
  /** True while a video job is starting or polling. */
  videoGenerationBusy: boolean;
  muapiAudioFileNames: string[];
  /** Set when the selected Character Profile's voice sample will be auto-attached as @audio1. */
  profileVoiceName: string | null;
  onMuapiAudioFilesChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearMuapiAudio: () => void;
  onStartVideo: () => void;
  onRegenerate: () => void;
};

export function SheetStep({
  busy,
  sheetUrl,
  sheetSource,
  videoProvider,
  onVideoProviderChange,
  videoProviderEnvLoaded,
  atlasConfigured,
  muapiConfigured,
  canStartVideo,
  videoGenerationBusy = false,
  muapiAudioFileNames,
  profileVoiceName,
  onMuapiAudioFilesChange,
  onClearMuapiAudio,
  onStartVideo,
  onRegenerate,
}: SheetStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            4
          </div>
          <CardTitle className="text-xl">Review Frame Sequence Sheet</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sheetUrl}
            alt="Frame sequence sheet reference"
            className="max-h-[400px] w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
          {videoProviderEnvLoaded ? (
            <label className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              Video backend
              <select
                value={videoProvider}
                disabled={busy}
                onChange={(e) =>
                  onVideoProviderChange(e.target.value as VideoProvider)
                }
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="atlas" disabled={!atlasConfigured}>
                  480p
                </option>
                <option value="muapi" disabled={!muapiConfigured}>
                  720p
                </option>
              </select>
            </label>
          ) : (
            <span className="text-xs text-zinc-400">Loading video backends…</span>
          )}
          <Button
            type="button"
            disabled={busy || !canStartVideo || videoGenerationBusy}
            onClick={onStartVideo}
            className="rounded-full px-6"
          >
            {videoGenerationBusy ? (
              <>
                <Spinner className="mr-2 h-4 w-4" /> Starting video…
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
            {busy && !videoGenerationBusy ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {sheetSource === "uploaded" ? "Opening…" : "Regenerating…"}
              </>
            ) : sheetSource === "uploaded" ? (
              "Replace Reference"
            ) : (
              "Regenerate Image"
            )}
          </Button>
        </div>

        <p className="text-xs text-zinc-500">
          {videoProvider === "muapi"
            ? "720p · Optional MP3/WAV voice reference (up to 3 files, ≤15s total)."
            : "480p"}
        </p>

        {videoProvider === "muapi" && muapiConfigured ? (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Voice reference (optional)
            </p>
            {profileVoiceName && !muapiAudioFileNames.length ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Your character profile&apos;s voice sample{" "}
                <span className="font-medium">{profileVoiceName}</span> will be used as{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-300">@audio1</span>
                . Add files below to override it for this run.
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Upload up to 3 clips. The prompt uses{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-300">@audio1</span>{" "}
                as the voice reference (and @audio2, @audio3 when you add more).
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900">
                <input
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav,audio/wave,audio/x-wav"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={onMuapiAudioFilesChange}
                />
                Add audio samples
              </label>
              {muapiAudioFileNames.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={onClearMuapiAudio}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            {muapiAudioFileNames.length ? (
              <ul className="text-xs text-zinc-600 dark:text-zinc-400">
                {muapiAudioFileNames.map((name, i) => (
                  <li key={`${name}-${i}`}>
                    @audio{i + 1}: {name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
