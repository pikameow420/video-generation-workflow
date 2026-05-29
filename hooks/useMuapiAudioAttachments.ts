"use client";

import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";

import { fileToDataUrl } from "@/lib/pipeline/wizard-utils";
import {
  maxMuapiAudioBytesPerFile,
  maxMuapiAudioFiles,
} from "@/lib/schemas";
import { toast } from "sonner";

export function useMuapiAudioAttachments() {
  const [muapiAudioDataUrls, setMuapiAudioDataUrls] = useState<string[]>([]);
  const [muapiAudioFileNames, setMuapiAudioFileNames] = useState<string[]>([]);

  const clearMuapiAudio = useCallback(() => {
    setMuapiAudioDataUrls([]);
    setMuapiAudioFileNames([]);
  }, []);

  const onMuapiAudioFilesChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.currentTarget.value = "";
      if (!files.length) return;

      const take = files.slice(0, maxMuapiAudioFiles);
      if (files.length > maxMuapiAudioFiles) {
        toast.info(`Only the first ${maxMuapiAudioFiles} clips are used.`);
      }

      void (async () => {
        for (const f of take) {
          const lower = f.name.toLowerCase();
          if (!lower.endsWith(".mp3") && !lower.endsWith(".wav")) {
            toast.error("Voice clips must be MP3 or WAV.");
            return;
          }
          if (f.size > maxMuapiAudioBytesPerFile) {
            toast.error(
              `Each file must be ≤ ${Math.round(
                maxMuapiAudioBytesPerFile / (1024 * 1024),
              )}MB.`,
            );
            return;
          }
        }
        try {
          const urls: string[] = [];
          const names: string[] = [];
          for (const f of take) {
            urls.push(await fileToDataUrl(f));
            names.push(f.name);
          }
          setMuapiAudioDataUrls(urls);
          setMuapiAudioFileNames(names);
          toast.success(
            urls.length === 1
              ? "Voice clip attached."
              : `${urls.length} voice clips attached.`,
          );
        } catch {
          toast.error("Could not read those audio files.");
        }
      })();
    },
    [],
  );

  return {
    muapiAudioDataUrls,
    muapiAudioFileNames,
    clearMuapiAudio,
    onMuapiAudioFilesChange,
  };
}
