"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import type {
  CharacterProfile,
  PendingVideoJob,
  Step,
} from "@/components/pipeline/types";
import { ApiRequestError, postJson } from "@/lib/api/client";
import { FREE_VIDEO_LIMIT_REACHED } from "@/lib/auth/video-quota-policy";
import type { RunApiAction } from "@/hooks/useApiAction";
import type { RunReadinessResult } from "@/lib/pipeline/run-readiness";
import type { VideoProvider, VideoRequest } from "@/lib/schemas";
import {
  frameSequenceSheetResponseSchema,
  videoStartResponseSchema,
} from "@/lib/schemas";
import { fetchVoiceSampleDataUrl } from "@/lib/pipeline/wizard-utils";
import { toast } from "sonner";

type UseWizardSheetVideoGenerationOptions = {
  runApiAction: RunApiAction;
  setError: Dispatch<SetStateAction<string | null>>;
  setFrameSheetGenerationBusy: Dispatch<SetStateAction<boolean>>;
  maybeSaveGeneratedScript: () => Promise<void>;
  scriptEdit: { title: string; body: string };
  artDirection: string;
  runProfileIds: string[];
  saveSheetToSelectedProfiles: (imageDataUrl: string) => Promise<void>;
  buildCharacterAnchors: () => Array<{
    name: string;
    characterSheetUrl: string;
    referenceImageUrls?: string[];
  }>;
  frameSheetExtraReferenceUrls: string[];
  frameSheetReadiness: RunReadinessResult;
  muapiVideoReadiness: RunReadinessResult;
  recordSheetScriptHistory: () => void;
  recordSheetScriptHistoryWhenReady: () => void;
  setSheetUrl: Dispatch<SetStateAction<string | null>>;
  setSheetSource: Dispatch<SetStateAction<"generated" | "uploaded">>;
  setStep: Dispatch<SetStateAction<Step>>;

  sheetUrl: string | null;
  videoProvider: VideoProvider;
  muapiAudioDataUrls: string[];
  characterProfiles: CharacterProfile[];

  setVideoGenerationBusy: Dispatch<SetStateAction<boolean>>;
  setSubtitleSrt: Dispatch<SetStateAction<string>>;
  setSubtitleChars: Dispatch<SetStateAction<number | null>>;
  setSubtitleVideoDurationSec: Dispatch<SetStateAction<number | null>>;
  setVideoStatus: Dispatch<SetStateAction<string>>;
  setPendingVideoJob: Dispatch<SetStateAction<PendingVideoJob | null>>;
  setVideoMeta: Dispatch<SetStateAction<{ predictionId: string } | null>>;
  onQuotaLimit: () => void;
  onVideoStarted?: () => void;
};

export function useWizardSheetVideoGeneration(
  options: UseWizardSheetVideoGenerationOptions,
) {
  const {
    runApiAction,
    setError,
    setFrameSheetGenerationBusy,
    maybeSaveGeneratedScript,
    scriptEdit,
    artDirection,
    runProfileIds,
    saveSheetToSelectedProfiles,
    buildCharacterAnchors,
    frameSheetExtraReferenceUrls,
    frameSheetReadiness,
    muapiVideoReadiness,
    recordSheetScriptHistory,
    recordSheetScriptHistoryWhenReady,
    setSheetUrl,
    setSheetSource,
    setStep,
    sheetUrl,
    videoProvider,
    muapiAudioDataUrls,
    characterProfiles,
    setVideoGenerationBusy,
    setSubtitleSrt,
    setSubtitleChars,
    setSubtitleVideoDurationSec,
    setVideoStatus,
    setPendingVideoJob,
    setVideoMeta,
    onQuotaLimit,
    onVideoStarted,
  } = options;

  const generateSheet = useCallback(async () => {
    if (!frameSheetReadiness.ok) {
      toast.error(frameSheetReadiness.reason);
      return;
    }

    toast.info("Generating Video Sheet...");
    setFrameSheetGenerationBusy(true);
    try {
      await maybeSaveGeneratedScript();
      const characterAnchors = buildCharacterAnchors();
      const extraRefs = frameSheetExtraReferenceUrls.map((u) => u.trim()).filter(Boolean);
      const data = await postJson(
        "/api/frame-sequence-sheet",
        {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          artDirection: artDirection || undefined,
          referenceImageUrls: extraRefs.length ? extraRefs : undefined,
          characterAnchors: characterAnchors.length ? characterAnchors : undefined,
        },
        "Video Sheet failed",
        frameSequenceSheetResponseSchema,
      );
      setSheetUrl(data.imageDataUrl);
      setSheetSource("generated");
      recordSheetScriptHistory();
      setStep("sheet");
      toast.success("Video Sheet generated.");
      await saveSheetToSelectedProfiles(data.imageDataUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Request failed";
      setError(message);
      toast.error(message);
    } finally {
      setFrameSheetGenerationBusy(false);
    }
  }, [
    artDirection,
    buildCharacterAnchors,
    frameSheetExtraReferenceUrls,
    frameSheetReadiness,
    maybeSaveGeneratedScript,
    saveSheetToSelectedProfiles,
    setError,
    setFrameSheetGenerationBusy,
    scriptEdit,
    setSheetSource,
    setSheetUrl,
    setStep,
    recordSheetScriptHistory,
  ]);

  const startVideo = useCallback(async () => {
    if (!sheetUrl) return;

    if (videoProvider === "muapi" && !muapiVideoReadiness.ok) {
      toast.error(muapiVideoReadiness.reason);
      return;
    }

    toast.info("Preparing references and starting video job...");
    await runApiAction(async () => {
      setVideoGenerationBusy(true);
      let jobStarted = false;
      try {
        setSubtitleSrt("");
        setSubtitleChars(null);
        setSubtitleVideoDurationSec(null);
        setVideoStatus("Starting video job…");
        setStep("video");

        let audioDataUrls: string[] | undefined;
        if (videoProvider === "muapi" && muapiAudioDataUrls.length > 0) {
          audioDataUrls = muapiAudioDataUrls;
        } else if (videoProvider === "muapi") {
          const clips: string[] = [];
          for (const profileId of runProfileIds) {
            const profile = characterProfiles.find((p) => p.id === profileId);
            if (!profile?.voiceSample) continue;
            clips.push(await fetchVoiceSampleDataUrl(profile.voiceSample));
          }
          if (clips.length) audioDataUrls = clips;
        }

        const payload: VideoRequest = {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          imageDataUrlOrUrl: sheetUrl,
          runProfileIds,
          provider: videoProvider,
          ...(audioDataUrls ? { audioDataUrls } : {}),
        };

        let data;
        try {
          data = await postJson(
            "/api/video",
            payload,
            "Video failed",
            videoStartResponseSchema,
          );
        } catch (err) {
          if (
            err instanceof ApiRequestError &&
            err.code === FREE_VIDEO_LIMIT_REACHED
          ) {
            onQuotaLimit();
            return;
          }
          throw err;
        }
        const trimmedTitle = scriptEdit.title.trim().slice(0, 200);
        const job: PendingVideoJob = {
          predictionId: data.predictionId,
          provider: data.provider,
          startedAt: new Date().toISOString(),
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
        };
        setPendingVideoJob(job);
        setVideoMeta({ predictionId: data.predictionId });
        setVideoStatus("Generating video…");
        recordSheetScriptHistoryWhenReady();
        onVideoStarted?.();
        jobStarted = true;
      } finally {
        if (!jobStarted) setVideoGenerationBusy(false);
      }
    }, "Request failed");
  }, [
    characterProfiles,
    muapiAudioDataUrls,
    muapiVideoReadiness,
    runApiAction,
    runProfileIds,
    scriptEdit,
    sheetUrl,
    setPendingVideoJob,
    setStep,
    setSubtitleChars,
    setSubtitleSrt,
    setSubtitleVideoDurationSec,
    setVideoGenerationBusy,
    setVideoMeta,
    setVideoStatus,
    onQuotaLimit,
    onVideoStarted,
    recordSheetScriptHistoryWhenReady,
    videoProvider,
  ]);

  return { generateSheet, startVideo };
}
