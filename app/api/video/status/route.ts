import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { pollAtlasVideoOnce } from "@/lib/seedance/client";
import { pollMuapiVideoOnce } from "@/lib/muapi/client";
import { videoStatusQuerySchema } from "@/lib/schemas";
import {
  getPipelineVideoRecord,
  ingestRemotePipelineVideo,
} from "@/lib/uploads/pipeline-video-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = videoStatusQuerySchema.parse({
      predictionId: url.searchParams.get("predictionId"),
      provider: url.searchParams.get("provider"),
      title: url.searchParams.get("title"),
    });

    const existing = await getPipelineVideoRecord(query.predictionId);
    if (existing?.url) {
      return NextResponse.json({
        status: "completed" as const,
        predictionId: query.predictionId,
        videoUrl: existing.url,
        hasCaptions: existing.hasCaptions,
      });
    }

    const outcome =
      query.provider === "muapi"
        ? await pollMuapiVideoOnce(query.predictionId)
        : await pollAtlasVideoOnce(query.predictionId);

    if (outcome.status === "processing") {
      return NextResponse.json({
        status: "processing" as const,
        predictionId: query.predictionId,
      });
    }

    if (outcome.status === "failed") {
      return NextResponse.json({
        status: "failed" as const,
        predictionId: query.predictionId,
        error: outcome.error,
      });
    }

    const saved = await ingestRemotePipelineVideo({
      sourceUrl: outcome.videoUrl,
      predictionId: query.predictionId,
      title: query.title,
    });

    return NextResponse.json({
      status: "completed" as const,
      predictionId: query.predictionId,
      videoUrl: saved.url,
      hasCaptions: saved.hasCaptions,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to check video status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
