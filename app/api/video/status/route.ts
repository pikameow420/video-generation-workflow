import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { pollAtlasVideoOnce } from "@/lib/seedance/client";
import { pollMuapiVideoOnce } from "@/lib/muapi/client";
import { videoStatusQuerySchema } from "@/lib/schemas";
import { requireUser } from "@/lib/auth/require-user";
import { verifyPredictionOwnership } from "@/lib/auth/prediction-ownership";
import {
  getPipelineVideoRecord,
  ingestRemotePipelineVideo,
} from "@/lib/uploads/pipeline-video-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const query = videoStatusQuerySchema.parse({
      predictionId: url.searchParams.get("predictionId"),
      provider: url.searchParams.get("provider"),
      title: url.searchParams.get("title"),
    });

    const isOwner = await verifyPredictionOwnership(query.predictionId, auth.user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const existing = await getPipelineVideoRecord(query.predictionId, auth.user.id);
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
      userId: auth.user.id,
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
