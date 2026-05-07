import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  transcribeSubtitlesRequestSchema,
  transcribeSubtitlesResponseSchema,
} from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import { toSrt } from "@/lib/subtitles/format";
import { transcribeVideoFromUrl } from "@/lib/subtitles/transcribe";

export const runtime = "nodejs";
export const maxDuration = 300;

function resolveVideoUrl(videoUrl: string, reqUrl: string): string {
  const trimmed = videoUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return new URL(trimmed, reqUrl).toString();
  }
  throw new Error("videoUrl must be an https URL or app-relative path");
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = transcribeSubtitlesRequestSchema.parse(json);
    const env = getEnv();
    const maxCharsPerLine =
      body.maxCharsPerLine ?? env.SUBTITLE_MAX_CHARS_PER_LINE;
    const maxSecondsPerCue = env.SUBTITLE_MAX_SECONDS_PER_CUE;
    const maxWordsPerCue = env.SUBTITLE_MAX_WORDS_PER_CUE;
    const requestedLanguage = body.language?.trim().toLowerCase();
    const language =
      requestedLanguage === undefined
        ? env.SUBTITLE_DEFAULT_LANGUAGE
        : requestedLanguage === "" || requestedLanguage === "auto"
          ? undefined
          : requestedLanguage;
    const videoUrl = resolveVideoUrl(body.videoUrl, req.url);

    const result = await transcribeVideoFromUrl({
      videoUrl,
      language,
      maxCharsPerLine,
      maxSecondsPerCue,
      maxWordsPerCue,
    });
    const response = transcribeSubtitlesResponseSchema.parse({
      cues: result.cues,
      srtText: toSrt(result.cues),
      estimatedChars: result.estimatedChars,
    });
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
