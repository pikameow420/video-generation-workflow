import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { burnSubtitlesRequestSchema } from "@/lib/schemas";
import {
  INSTAGRAM_SUBTITLE_STYLE,
  ffmpegSubtitleStyle,
} from "@/lib/subtitles/style";
import { resolveSubtitleVideoUrl } from "@/lib/subtitles/resolve-video-url";
import { putPipelineVideo } from "@/lib/uploads/pipeline-video-store";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 300;

function escapeFfmpegPath(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,");
}

async function ensureFfmpegExists(): Promise<void> {
  await execFileAsync("ffmpeg", ["-version"]);
}

async function ensureSubtitleFilterExists(): Promise<void> {
  const { stdout } = await execFileAsync("ffmpeg", ["-hide_banner", "-filters"]);
  const hasSubtitlesFilter = /(^|\n).*\bsubtitles\b/m.test(stdout);
  if (!hasSubtitlesFilter) {
    throw new Error(
      "Your ffmpeg build does not include the subtitles filter (libass). Install/rebuild ffmpeg with libass support, then retry subtitle burn.",
    );
  }
}

export async function POST(req: Request) {
  const tmpPrefix = path.join(os.tmpdir(), `subtitle-burn-${randomUUID()}`);
  const inputPath = `${tmpPrefix}-in.mp4`;
  const srtPath = `${tmpPrefix}.srt`;
  const outputPath = `${tmpPrefix}-out.mp4`;

  try {
    const json = await req.json();
    const body = burnSubtitlesRequestSchema.parse(json);
    const resolvedVideoUrl = resolveSubtitleVideoUrl(body.videoUrl, req.url);
    await ensureFfmpegExists();
    await ensureSubtitleFilterExists();

    const res = await fetch(resolvedVideoUrl);
    if (!res.ok) {
      throw new Error(`Could not download source video (${res.status})`);
    }
    const inputVideo = new Uint8Array(await res.arrayBuffer());
    await writeFile(inputPath, inputVideo);
    await writeFile(srtPath, body.srtText, "utf8");

    const style = ffmpegSubtitleStyle(INSTAGRAM_SUBTITLE_STYLE);
    const vf = `subtitles=filename='${escapeFfmpegPath(srtPath)}':force_style='${style}'`;

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const outputBytes = new Uint8Array(await readFile(outputPath));
    const saved = await putPipelineVideo({
      bytes: outputBytes,
      predictionId: body.predictionId,
      hasCaptions: true,
    });

    return NextResponse.json({ videoUrl: saved.url, hasCaptions: true as const });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to burn subtitles";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await Promise.allSettled([
      rm(inputPath, { force: true }),
      rm(srtPath, { force: true }),
      rm(outputPath, { force: true }),
    ]);
  }
}
