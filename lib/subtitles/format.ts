import type { SubtitleCue } from "@/lib/subtitles/types";

function clampSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function formatSrtTime(seconds: number): string {
  const totalMs = Math.floor(clampSeconds(seconds) * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function splitCaptionLine(text: string, maxCharsPerLine: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

export function toSrt(cues: SubtitleCue[]): string {
  return cues
    .filter((cue) => cue.text.trim())
    .map((cue, index) => {
      const start = formatSrtTime(cue.startSec);
      const end = formatSrtTime(Math.max(cue.endSec, cue.startSec + 0.1));
      return `${index + 1}\n${start} --> ${end}\n${cue.text.trim()}`;
    })
    .join("\n\n");
}
