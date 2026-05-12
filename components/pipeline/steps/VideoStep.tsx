"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type VideoStepProps = {
  busy: boolean;
  videoStatus: string;
  videoUrl: string | null;
  sheetUrl: string | null;
  subtitleSrt: string;
  subtitleLanguage: "auto" | "en" | "hi" | "hinglish";
  subtitleChars: number | null;
  captionedVideoUrl: string | null;
  videoMeta: { predictionId: string } | null;
  onStartVideo: () => void;
  onGoTopic: () => void;
  onGenerateSubtitles: () => void;
  onBurnSubtitles: () => void;
  onSubtitleLanguageChange: (next: "auto" | "en" | "hi" | "hinglish") => void;
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
  captionedVideoUrl,
  videoMeta,
  onStartVideo,
  onGoTopic,
  onGenerateSubtitles,
  onBurnSubtitles,
  onSubtitleLanguageChange,
  onSubtitleSrtChange,
}: VideoStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            4
          </div>
          <CardTitle className="text-xl">Final Video</CardTitle>
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
                This can take several minutes. Please don&apos;t close the tab.
              </p>
            </div>
          </div>
        ) : null}

        {videoUrl ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
              <video
                className="max-h-[600px] w-full object-contain"
                src={videoUrl}
                controls
                playsInline
                autoPlay
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Download / Open Link ↗
              </a>
              <Button type="button" variant="outline" onClick={onGoTopic} className="rounded-full">
                Start New Project
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Post-Generation Subtitles
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-zinc-500">
                  Caption language
                  <select
                    value={subtitleLanguage}
                    onChange={(e) =>
                      onSubtitleLanguageChange(
                        e.target.value as "auto" | "en" | "hi" | "hinglish",
                      )
                    }
                    disabled={busy}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    <option value="auto">Auto detect</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="hinglish">Hinglish (Roman Hindi)</option>
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerateSubtitles}
                  disabled={busy}
                  className="rounded-full"
                >
                  {busy ? "Working..." : "Generate Subtitles"}
                </Button>
                <Button
                  type="button"
                  onClick={onBurnSubtitles}
                  disabled={busy || !subtitleSrt.trim()}
                  className="rounded-full"
                >
                  {busy ? "Burning..." : "Create Instagram-ready Video"}
                </Button>
                {subtitleChars !== null ? (
                  <span className="text-xs text-zinc-500">Subtitle chars: {subtitleChars}</span>
                ) : null}
              </div>

              <Textarea
                className="min-h-[140px] text-xs leading-relaxed"
                placeholder="Generated subtitles (SRT) will appear here..."
                value={subtitleSrt}
                onChange={(e) => onSubtitleSrtChange(e.target.value)}
              />
            </div>

            {captionedVideoUrl ? (
              <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Instagram-ready captioned video
                </p>
                <div className="overflow-hidden rounded-lg border border-zinc-200 bg-black dark:border-zinc-800">
                  <video
                    className="max-h-[600px] w-full object-contain"
                    src={captionedVideoUrl}
                    controls
                    playsInline
                  />
                </div>
                <a
                  href={captionedVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Download Captioned Video ↗
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {!busy && !videoUrl ? (
          <div className="flex items-center gap-3">
            <Button type="button" onClick={sheetUrl ? onStartVideo : onGoTopic} className="rounded-full">
              {sheetUrl ? "Retry Video Generation" : "Start Over"}
            </Button>
          </div>
        ) : null}

        {videoMeta && !busy ? (
          <p className="mt-4 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
            Job ID: {videoMeta.predictionId}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
