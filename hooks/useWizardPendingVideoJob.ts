"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";

import type { PendingVideoJob, Step } from "@/components/pipeline/types";
import { toast } from "sonner";

import type { PendingVideoJob as HookPendingVideoJob } from "@/hooks/useVideoJobPoll";
import { useVideoJobPoll } from "@/hooks/useVideoJobPoll";

/**
 * Wraps {@link useVideoJobPoll} with stable callbacks (`ref`) so polling does not restart every render,
 * plus default toasts/state updates after complete/failed.
 */
export function useWizardPendingVideoJob(options: {
  pendingVideoJob: PendingVideoJob | null;
  setVideoUrl: Dispatch<SetStateAction<string | null>>;
  setVideoMeta: Dispatch<SetStateAction<{ predictionId: string } | null>>;
  setVideoHasCaptions: Dispatch<SetStateAction<boolean>>;
  setPendingVideoJob: Dispatch<SetStateAction<PendingVideoJob | null>>;
  setVideoStatus: Dispatch<SetStateAction<string>>;
  setVideoGenerationBusy: Dispatch<SetStateAction<boolean>>;
  setStep: Dispatch<SetStateAction<Step>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): void {
  const ref = useRef(options);
  useEffect(() => {
    ref.current = options;
  });

  const onProcessing = useCallback(() => {
    ref.current.setVideoStatus("Rendering your video…");
  }, []);

  const onCompleted = useCallback(
    (result: {
      predictionId: string;
      videoUrl: string;
      hasCaptions: boolean;
    }) => {
      const cur = ref.current;
      cur.setVideoUrl(result.videoUrl);
      cur.setVideoMeta({ predictionId: result.predictionId });
      cur.setVideoHasCaptions(result.hasCaptions);
      cur.setPendingVideoJob(null);
      cur.setVideoStatus("Finished.");
      cur.setVideoGenerationBusy(false);
      cur.setStep("video");
      toast.success("Your video is ready.");
    },
    [],
  );

  const onFailed = useCallback((message: string) => {
    const cur = ref.current;
    cur.setPendingVideoJob(null);
    cur.setVideoStatus("");
    cur.setVideoGenerationBusy(false);
    cur.setError(message);
    toast.error(message);
  }, []);

  useVideoJobPoll({
    pendingJob: options.pendingVideoJob as HookPendingVideoJob | null,
    onProcessing,
    onCompleted,
    onFailed,
  });
}
