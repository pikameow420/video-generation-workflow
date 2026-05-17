import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  transcribeSubtitlesRequestSchema,
  transcribeSubtitlesResponseSchema,
} from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import { buildCuesFromPipelineScript } from "@/lib/subtitles/from-script";
import { toSrt } from "@/lib/subtitles/format";
import { resolveSubtitleVideoUrl } from "@/lib/subtitles/resolve-video-url";
import { transcribeVideoFromUrl } from "@/lib/subtitles/transcribe";

export const runtime = "nodejs";
export const maxDuration = 300;

function resolveSubtitleLanguageConfig(
  input: string | undefined,
  defaultLanguage: string,
): {
  language?: string;
  prompt?: string;
} {
  const requested = input?.trim().toLowerCase();
  if (requested === undefined) {
    return { language: defaultLanguage };
  }
  if (!requested || requested === "auto") {
    return {};
  }
  if (requested === "hinglish") {
    // Use English as the Whisper language hint so output stays Latin script. `hi`
    // strongly biases toward Devanagari, which defeats "Roman Hindi" captions.
    return {
      language: "en",
      prompt:
        "Transcription is Hinglish: casual mix of spoken English and Hindi, written ONLY with Latin/Roman letters. Keep English phrases in normal spelling; write Hindi parts in everyday roman Hindi (no formal IAST unless obvious). Absolutely no Devanagari or other non-Latin scripts. No translation into Hindi—transcribe what was said.",
    };
  }
  return { language: requested };
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

    if (body.language?.trim().toLowerCase() === "script") {
      const scriptBody = body.scriptBody?.trim() ?? "";
      if (!scriptBody.length) {
        return NextResponse.json(
          { error: "scriptBody is required when language is script" },
          { status: 400 },
        );
      }
      const durationSec =
        body.videoDurationSec !== undefined && body.videoDurationSec > 0
          ? body.videoDurationSec
          : 15;
      const cues = buildCuesFromPipelineScript(scriptBody, {
        durationSec,
        maxCharsPerLine,
        maxSecondsPerCue,
        maxWordsPerCue,
      });
      if (!cues.length) {
        return NextResponse.json(
          { error: "Could not build subtitles from script (empty after parsing)" },
          { status: 400 },
        );
      }
      const response = transcribeSubtitlesResponseSchema.parse({
        cues,
        srtText: toSrt(cues),
        estimatedChars: cues.reduce((sum, cue) => sum + cue.text.length, 0),
      });
      return NextResponse.json(response);
    }

    const subtitleConfig = resolveSubtitleLanguageConfig(
      body.language,
      env.SUBTITLE_DEFAULT_LANGUAGE,
    );
    const language =
      subtitleConfig.language === undefined &&
      body.language !== undefined &&
      body.language.trim().toLowerCase() === "auto"
        ? undefined
        : subtitleConfig.language ?? env.SUBTITLE_DEFAULT_LANGUAGE;
    const videoUrl = resolveSubtitleVideoUrl(body.videoUrl, req.url);

    const result = await transcribeVideoFromUrl({
      videoUrl,
      language,
      prompt: subtitleConfig.prompt,
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
