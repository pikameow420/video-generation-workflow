"use client";

import { useEffect } from "react";
import { getJson } from "@/lib/api/client";
import {
  videoStatusResponseSchema,
  type VideoProvider,
} from "@/lib/schemas";

export type PendingVideoJob = {
  predictionId: string;
  provider: VideoProvider;
  startedAt: string;
};

const DEFAULT_POLL_MS = 20_000;
const DEFAULT_MAX_MS = 900_000;

export function useVideoJobPoll({
  pendingJob,
  onProcessing,
  onCompleted,
  onFailed,
  pollIntervalMs = DEFAULT_POLL_MS,
  pollMaxMs = DEFAULT_MAX_MS,
}: {
  pendingJob: PendingVideoJob | null;
  onProcessing?: () => void;
  onCompleted: (result: {
    predictionId: string;
    videoUrl: string;
    hasCaptions: boolean;
  }) => void;
  onFailed: (message: string) => void;
  pollIntervalMs?: number;
  pollMaxMs?: number;
}) {
  useEffect(() => {
    if (!pendingJob) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + pollMaxMs;

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() > deadline) {
        onFailed("Timed out waiting for video generation");
        return;
      }

      try {
        const params = new URLSearchParams({
          predictionId: pendingJob.predictionId,
          provider: pendingJob.provider,
        });
        const data = await getJson(
          `/api/video/status?${params.toString()}`,
          "Video status check failed",
          videoStatusResponseSchema,
        );

        if (cancelled) return;

        if (data.status === "completed") {
          onCompleted({
            predictionId: data.predictionId,
            videoUrl: data.videoUrl,
            hasCaptions: data.hasCaptions,
          });
          return;
        }

        if (data.status === "failed") {
          onFailed(data.error);
          return;
        }

        onProcessing?.();
        timeoutId = setTimeout(() => void poll(), pollIntervalMs);
      } catch {
        if (cancelled) return;
        onProcessing?.();
        timeoutId = setTimeout(() => void poll(), pollIntervalMs);
      }
    };

    void poll();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (timeoutId) clearTimeout(timeoutId);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    pendingJob,
    onProcessing,
    onCompleted,
    onFailed,
    pollIntervalMs,
    pollMaxMs,
  ]);
}
