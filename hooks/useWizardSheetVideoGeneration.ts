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
import type { VideoProvider, VideoRequest } from "@/lib/schemas";
import {
  frameSequenceSheetResponseSchema,
  videoStartResponseSchema,
} from "@/lib/schemas";
import { toast } from "sonner";

type UseWizardSheetVideoGenerationOptions = {
  runApiAction: RunApiAction;
  maybeSaveGeneratedScript: () => Promise<void>;
  scriptEdit: { title: string; body: string };
  artDirection: string;
  selectedReferenceUrls: string[];
  saveSheetToSelectedProfile: (imageDataUrl: string) => Promise<void>;
  trackSheetScriptSelection: () => void;
  setSheetUrl: Dispatch<SetStateAction<string | null>>;
  setSheetSource: Dispatch<SetStateAction<"generated" | "uploaded">>;
  setStep: Dispatch<SetStateAction<Step>>;

  sheetUrl: string | null;
  videoProvider: VideoProvider;
  muapiAudioDataUrls: string[];
  useProfileVoice: boolean;
  selectedCharacterProfile: CharacterProfile | null;
  fetchProfileVoiceDataUrl: () => Promise<string | null>;

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
    maybeSaveGeneratedScript,
    scriptEdit,
    artDirection,
    selectedReferenceUrls,
    saveSheetToSelectedProfile,
    trackSheetScriptSelection,
    setSheetUrl,
    setSheetSource,
    setStep,
    sheetUrl,
    videoProvider,
    muapiAudioDataUrls,
    useProfileVoice,
    selectedCharacterProfile,
    fetchProfileVoiceDataUrl,
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
    toast.info("Creating your visual sheet…");
    await runApiAction(async () => {
      await maybeSaveGeneratedScript();
      const data = await postJson(
        "/api/frame-sequence-sheet",
        {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          artDirection: artDirection || undefined,
          referenceImageUrls: selectedReferenceUrls.length
            ? selectedReferenceUrls
            : undefined,
        },
        "Frame sequence sheet failed",
        frameSequenceSheetResponseSchema,
      );
      setSheetUrl(data.imageDataUrl);
      setSheetSource("generated");
      trackSheetScriptSelection();
      setStep("sheet");
      toast.success("Visual sheet is ready.");
      await saveSheetToSelectedProfile(data.imageDataUrl);
    }, "Request failed");
  }, [
    artDirection,
    maybeSaveGeneratedScript,
    runApiAction,
    saveSheetToSelectedProfile,
    scriptEdit,
    selectedReferenceUrls,
    setSheetSource,
    setSheetUrl,
    setStep,
    trackSheetScriptSelection,
  ]);

  const startVideo = useCallback(async () => {
    if (!sheetUrl) return;
    toast.info("Starting your 15s video export…");
    await runApiAction(async () => {
      setVideoGenerationBusy(true);
      let jobStarted = false;
      try {
        setSubtitleSrt("");
        setSubtitleChars(null);
        setSubtitleVideoDurationSec(null);
        setVideoStatus("Starting export…");
        setStep("video");
        let audioDataUrls: string[] | undefined;
        if (videoProvider === "muapi" && muapiAudioDataUrls.length > 0) {
          audioDataUrls = muapiAudioDataUrls;
        } else if (
          videoProvider === "muapi" &&
          useProfileVoice &&
          selectedCharacterProfile?.voiceSample
        ) {
          const profileVoice = await fetchProfileVoiceDataUrl();
          if (profileVoice) {
            audioDataUrls = [profileVoice];
          }
        }
        const payload: VideoRequest = {
          scriptTitle: scriptEdit.title,
          scriptBody: scriptEdit.body,
          imageDataUrlOrUrl: sheetUrl,
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
        setVideoStatus("Rendering your video…");
        jobStarted = true;
        onVideoStarted?.();
      } finally {
        if (!jobStarted) setVideoGenerationBusy(false);
      }
    }, "Request failed");
  }, [
    onQuotaLimit,
    onVideoStarted,
    fetchProfileVoiceDataUrl,
    muapiAudioDataUrls,
    runApiAction,
    scriptEdit,
    selectedCharacterProfile,
    sheetUrl,
    setPendingVideoJob,
    setStep,
    setSubtitleChars,
    setSubtitleSrt,
    setSubtitleVideoDurationSec,
    setVideoGenerationBusy,
    setVideoMeta,
    setVideoStatus,
    useProfileVoice,
    videoProvider,
  ]);

  return { generateSheet, startVideo };
}
