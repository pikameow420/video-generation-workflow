"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import { toast } from "sonner";

import { postJson } from "@/lib/api/client";
import type { SubtitleLanguage } from "@/components/pipeline/types";
type ApiActionRunner = (
  action: () => Promise<void>,
  fallbackError: string,
) => Promise<void>;
import {
  burnSubtitlesResponseSchema,
  transcribeSubtitlesResponseSchema,
} from "@/lib/schemas";

/** Transcribe + burn subtitles (Video step actions). */
export function useWizardSubtitleActions(options: {
  runApiAction: ApiActionRunner;
  videoUrl: string | null;
  subtitleLanguage: SubtitleLanguage;
  scriptBody: string;
  scriptTitle: string;
  subtitleVideoDurationSec: number | null;
  subtitleSrt: string;
  videoMeta: { predictionId: string } | null;
  setSubtitleSrt: Dispatch<SetStateAction<string>>;
  setSubtitleChars: Dispatch<SetStateAction<number | null>>;
  setVideoHasCaptions: Dispatch<SetStateAction<boolean>>;
  setVideoUrl: Dispatch<SetStateAction<string | null>>;
}): {
  generateSubtitles: () => Promise<void>;
  burnSubtitles: () => Promise<void>;
} {
  const {
    runApiAction,
    videoUrl,
    subtitleLanguage,
    scriptBody,
    scriptTitle,
    subtitleVideoDurationSec,
    subtitleSrt,
    videoMeta,
    setSubtitleSrt,
    setSubtitleChars,
    setVideoHasCaptions,
    setVideoUrl,
  } = options;

  const generateSubtitles = useCallback(async () => {
    if (!videoUrl) return;
    if (subtitleLanguage === "script" && !scriptBody.trim()) {
      toast.error(
        "There is no script body to use for captions. Go back and pick or enter a script.",
      );
      return;
    }
    toast.info("Generating subtitles...");
    await runApiAction(async () => {
      const payload: Record<string, unknown> = {
        videoUrl,
        language: subtitleLanguage,
      };
      if (subtitleLanguage === "script") {
        payload.scriptBody = scriptBody.trim();
        if (
          subtitleVideoDurationSec != null &&
          Number.isFinite(subtitleVideoDurationSec) &&
          subtitleVideoDurationSec > 0
        ) {
          payload.videoDurationSec = subtitleVideoDurationSec;
        }
      }
      const data = await postJson(
        "/api/subtitles/transcribe",
        payload,
        "Subtitle generation failed",
        transcribeSubtitlesResponseSchema,
      );
      if (!data.srtText) throw new Error("Subtitle generation failed");
      setSubtitleSrt(data.srtText);
      setSubtitleChars(data.estimatedChars ?? null);
      setVideoHasCaptions(false);
      toast.success("Subtitles generated.");
    }, "Subtitle generation failed");
  }, [
    runApiAction,
    scriptBody,
    subtitleLanguage,
    subtitleVideoDurationSec,
    videoUrl,
    setSubtitleChars,
    setSubtitleSrt,
    setVideoHasCaptions,
  ]);

  const burnSubtitles = useCallback(async () => {
    if (!videoUrl || !subtitleSrt.trim() || !videoMeta?.predictionId) return;
    toast.info("Burning subtitles into video...");
    await runApiAction(async () => {
      const data = await postJson(
        "/api/subtitles/burn",
        {
          videoUrl,
          srtText: subtitleSrt,
          predictionId: videoMeta.predictionId,
          ...(scriptTitle.trim()
            ? { title: scriptTitle.trim().slice(0, 200) }
            : {}),
        },
        "Caption burn failed",
        burnSubtitlesResponseSchema,
      );
      if (!data.videoUrl) throw new Error("Caption burn failed");
      setVideoUrl(data.videoUrl);
      setVideoHasCaptions(true);
      toast.success("Captioned video ready.");
    }, "Caption burn failed");
  }, [
    runApiAction,
    subtitleSrt,
    scriptTitle,
    videoMeta,
    videoUrl,
    setVideoHasCaptions,
    setVideoUrl,
  ]);

  return { generateSubtitles, burnSubtitles };
}
