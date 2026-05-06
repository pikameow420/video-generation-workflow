import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import { splitCaptionLine } from "@/lib/subtitles/format";
import type { SubtitleCue } from "@/lib/subtitles/types";

type TranscribeResult = {
  cues: SubtitleCue[];
  rawText: string;
  estimatedChars: number;
};

type VerboseSegment = {
  start?: number;
  end?: number;
  text?: string;
};

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function normalizeCues(
  segments: VerboseSegment[] | undefined,
  fallbackText: string,
  maxCharsPerLine: number,
): SubtitleCue[] {
  const normalized = (segments ?? [])
    .filter((seg) => typeof seg.start === "number" && typeof seg.end === "number")
    .map((seg) => ({
      startSec: Math.max(0, seg.start as number),
      endSec: Math.max((seg.end as number) || 0, ((seg.start as number) || 0) + 0.15),
      text: splitCaptionLine(seg.text ?? "", maxCharsPerLine),
    }))
    .filter((cue) => cue.text.trim().length > 0);

  if (normalized.length) return normalized;
  const safeText = splitCaptionLine(fallbackText, maxCharsPerLine);
  if (!safeText) return [];
  return [{ startSec: 0, endSec: 4, text: safeText }];
}

export async function transcribeVideoFromUrl(options: {
  videoUrl: string;
  language?: string;
  maxCharsPerLine: number;
}): Promise<TranscribeResult> {
  const env = getEnv();
  const apiKey = env.WHISPER_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("WHISPER_API_KEY is required for subtitle transcription");
  }
  if (!isHttpUrl(options.videoUrl)) {
    throw new Error("videoUrl must be an http/https URL");
  }

  const videoRes = await fetch(options.videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Failed to download video (${videoRes.status})`);
  }
  const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
  const bytes = new Uint8Array(await videoRes.arrayBuffer());
  const file = new File([bytes], "video.mp4", { type: contentType });

  const client = new OpenAI({ apiKey });
  const response = (await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    language: options.language || undefined,
    temperature: 0,
    timestamp_granularities: ["segment"],
  })) as unknown as {
    text?: string;
    segments?: VerboseSegment[];
  };

  const rawText = response.text?.trim() ?? "";
  const cues = normalizeCues(
    response.segments,
    rawText,
    Math.max(16, options.maxCharsPerLine),
  );
  const estimatedChars = cues.reduce((sum, cue) => sum + cue.text.length, 0);
  return { cues, rawText, estimatedChars };
}
