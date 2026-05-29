"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import type { SubtitleLanguage } from "@/components/pipeline/types";

type VideoStepProps = {
  busy: boolean;
  videoStatus: string;
  videoUrl: string | null;
  sheetUrl: string | null;
  subtitleSrt: string;
  subtitleLanguage: SubtitleLanguage;
  subtitleChars: number | null;
  /** Playback length detected from preview; Caption language uses this for timings. */
  subtitleVideoDurationSec: number | null;
  videoHasCaptions: boolean;
  videoMeta: { predictionId: string } | null;
  videoStoredInLibrary: boolean;
  onStartVideo: () => void;
  onGoTopic: () => void;
  onStartNewRun: () => void | Promise<void>;
  onGenerateSubtitles: () => void;
  onBurnSubtitles: () => void;
  onSubtitleLanguageChange: (next: SubtitleLanguage) => void;
  onSubtitleVideoDurationKnown: (seconds: number | null) => void;
  onSubtitleSrtChange: (next: string) => void;
};

export function VideoStep({
  busy,
  videoStatus,
  videoUrl,
  sheetUrl,
  subtitleSrt,
  subtitleLanguage,
  subtitleChars,
  subtitleVideoDurationSec,
  videoHasCaptions,
  videoMeta,
  videoStoredInLibrary,
  onStartVideo,
  onGoTopic,
  onStartNewRun,
  onGenerateSubtitles,
  onBurnSubtitles,
  onSubtitleLanguageChange,
  onSubtitleVideoDurationKnown,
  onSubtitleSrtChange,
}: VideoStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            5
          </div>
          <CardTitle className="text-xl">Your video</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        {busy ? (
          <div className="space-y-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <Spinner className="h-8 w-8 text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {videoStatus || "Working…"}
              </p>
              <p className="text-sm text-zinc-500">
                This usually takes a few minutes. Keep this tab open until it finishes.
              </p>
            </div>
          </div>
        ) : null}

        {!busy && videoUrl ? (
          <div className="space-y-5">
            <div
              className={`space-y-3 rounded-xl border p-4 ${
                videoHasCaptions
                  ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  videoHasCaptions
                    ? "text-green-800 dark:text-green-200"
                    : "text-zinc-500"
                }`}
              >
                {videoHasCaptions ? "With burned-in captions" : "Preview"}
              </p>
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-black dark:border-zinc-800">
                <video
                  key={videoUrl}
                  className="max-h-[600px] w-full object-contain"
                  src={videoUrl}
                  controls
                  playsInline
                  onLoadedMetadata={(event) => {
                    const duration = event.currentTarget.duration;
                    onSubtitleVideoDurationKnown(
                      Number.isFinite(duration) ? duration : null,
                    );
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Download ↗
                </a>
                {videoMeta ? (
                  <span className="text-xs text-zinc-500">
                    Job {videoMeta.predictionId.slice(0, 8)}…
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                {videoStoredInLibrary ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    asChild
                  >
                    <Link href="/library">Open in My videos</Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void onStartNewRun()}
                >
                  Start another video
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Subtitles
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={subtitleLanguage}
                  onChange={(e) =>
                    onSubtitleLanguageChange(e.target.value as SubtitleLanguage)
                  }
                  disabled={busy}
                >
                  <option value="auto">Auto-detect speech</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                  <option value="script">From script</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerateSubtitles}
                  disabled={busy}
                  className="rounded-full"
                >
                  Generate SRT
                </Button>
                <Button
                  type="button"
                  onClick={onBurnSubtitles}
                  disabled={busy || !subtitleSrt.trim()}
                  className="rounded-full"
                >
                  Burn into video
                </Button>
                {subtitleChars !== null ? (
                  <span className="text-xs text-zinc-500">
                    Subtitle chars: {subtitleChars}
                  </span>
                ) : null}
              </div>
              {subtitleLanguage === "script" ? (
                <p className="text-xs text-zinc-500">
                  Timings follow your edited script (not speech recognition), spread across
                  the clip length from this preview{" "}
                  {subtitleVideoDurationSec != null
                    ? `(~${subtitleVideoDurationSec.toFixed(1)}s)`
                    : "—play the video once, or we assume ~15s"}
                  .
                </p>
              ) : null}
              <Textarea
                className="min-h-[140px] text-xs leading-relaxed"
                placeholder="Subtitle text (SRT format) appears here after you generate…"
                value={subtitleSrt}
                onChange={(e) => onSubtitleSrtChange(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {!busy && !videoUrl ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={sheetUrl ? onStartVideo : onGoTopic}
              className="rounded-full"
            >
              {sheetUrl ? "Try exporting again" : "Back to topic"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
