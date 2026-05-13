import { splitCaptionLine } from "@/lib/subtitles/format";
import { splitCueForPacing } from "@/lib/subtitles/transcribe";
import type { SubtitleCue } from "@/lib/subtitles/types";

/** Split script into caption-sized segments (paragraphs, then sentence-like chunks). */
export function segmentScriptForCaptions(scriptBody: string): string[] {
  const t = scriptBody.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const paras = t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of paras) {
    const hits = p
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (hits.length > 1) out.push(...hits);
    else out.push(p);
  }
  return out.length ? out : [t];
}

/**
 * Build subtitle cues from the pipeline script: word-weighted timing across `durationSec`,
 * then line-wrap and pacing splits (same rules as transcription post-processing).
 */
export function buildCuesFromPipelineScript(
  scriptBody: string,
  options: {
    durationSec: number;
    maxCharsPerLine: number;
    maxSecondsPerCue: number;
    maxWordsPerCue: number;
  },
): SubtitleCue[] {
  const segments = segmentScriptForCaptions(scriptBody);
  const wordCounts = segments.map((s) => s.split(/\s+/).filter(Boolean).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  if (totalWords < 1) return [];

  const durationSec = Math.max(0.5, options.durationSec);
  const minSeg = 0.25;
  let t = 0;
  const raw: SubtitleCue[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const words = Math.max(wordCounts[i], 1);
    const dur = Math.max(minSeg, (words / totalWords) * durationSec);
    const endSec = Math.min(t + dur, durationSec);
    const text = splitCaptionLine(segments[i], options.maxCharsPerLine);
    if (!text.trim()) {
      t = endSec;
      continue;
    }
    raw.push({
      startSec: t,
      endSec: Math.max(endSec, t + 0.15),
      text,
    });
    t = endSec;
  }

  if (!raw.length) return [];

  const last = raw[raw.length - 1];
  if (last.endSec < durationSec) {
    last.endSec = durationSec;
  }

  const { maxCharsPerLine, maxSecondsPerCue, maxWordsPerCue } = options;
  return raw
    .flatMap((cue) =>
      splitCueForPacing(
        cue,
        Math.max(16, maxCharsPerLine),
        Math.max(0.8, maxSecondsPerCue),
        Math.max(2, maxWordsPerCue),
      ),
    )
    .filter((cue) => cue.text.trim().length > 0);
}
