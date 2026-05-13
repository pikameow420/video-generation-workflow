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

function splitWordsIntoChunks(words: string[], chunkCount: number): string[] {
  if (!words.length) return [];
  const size = Math.max(1, Math.ceil(words.length / chunkCount));
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }
  return chunks;
}

export function splitCueForPacing(
  cue: SubtitleCue,
  maxCharsPerLine: number,
  maxSecondsPerCue: number,
  maxWordsPerCue: number,
): SubtitleCue[] {
  const text = cue.text.replace(/\s*\n+\s*/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const duration = Math.max(0.2, cue.endSec - cue.startSec);
  const chunkCount = Math.max(
    1,
    Math.ceil(duration / Math.max(0.5, maxSecondsPerCue)),
    Math.ceil(words.length / Math.max(1, maxWordsPerCue)),
  );
  if (chunkCount === 1) return [cue];

  const chunks = splitWordsIntoChunks(words, chunkCount);
  const unit = duration / chunks.length;
  const paced: SubtitleCue[] = [];
  let cursor = cue.startSec;

  for (let index = 0; index < chunks.length; index += 1) {
    const startSec = cursor;
    const endSec =
      index === chunks.length - 1
        ? cue.endSec
        : Math.min(cue.endSec, startSec + Math.max(0.2, unit));
    cursor = endSec;
    paced.push({
      startSec,
      endSec: Math.max(endSec, startSec + 0.15),
      text: splitCaptionLine(chunks[index], maxCharsPerLine),
    });
  }
  return paced;
}

function normalizeCues(
  segments: VerboseSegment[] | undefined,
  fallbackText: string,
  maxCharsPerLine: number,
  maxSecondsPerCue: number,
  maxWordsPerCue: number,
): SubtitleCue[] {
  const normalized = (segments ?? [])
    .filter((seg) => typeof seg.start === "number" && typeof seg.end === "number")
    .map((seg) => ({
      startSec: Math.max(0, seg.start as number),
      endSec: Math.max((seg.end as number) || 0, ((seg.start as number) || 0) + 0.15),
      text: splitCaptionLine(seg.text ?? "", maxCharsPerLine),
    }))
    .filter((cue) => cue.text.trim().length > 0);

  if (normalized.length) {
    return normalized
      .flatMap((cue) =>
        splitCueForPacing(cue, maxCharsPerLine, maxSecondsPerCue, maxWordsPerCue),
      )
      .filter((cue) => cue.text.trim().length > 0);
  }
  const safeText = splitCaptionLine(fallbackText, maxCharsPerLine);
  if (!safeText) return [];
  return [{ startSec: 0, endSec: 4, text: safeText }];
}

export async function transcribeVideoFromUrl(options: {
  videoUrl: string;
  language?: string;
  prompt?: string;
  maxCharsPerLine: number;
  maxSecondsPerCue: number;
  maxWordsPerCue: number;
}): Promise<TranscribeResult> {
  const env = getEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is required for subtitle transcription");
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
    prompt: options.prompt?.trim() ? options.prompt.trim() : undefined,
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
    Math.max(0.8, options.maxSecondsPerCue),
    Math.max(2, options.maxWordsPerCue),
  );
  const estimatedChars = cues.reduce((sum, cue) => sum + cue.text.length, 0);
  return { cues, rawText, estimatedChars };
}
