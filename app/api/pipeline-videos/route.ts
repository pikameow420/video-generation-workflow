import { NextResponse } from "next/server";
import {
  getPipelineVideoRecord,
  listPipelineVideosPage,
  softDeletePipelineVideo,
} from "@/lib/uploads/pipeline-video-store";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const predictionId = url.searchParams.get("predictionId")?.trim();
    if (predictionId) {
      const record = await getPipelineVideoRecord(predictionId);
      if (!record || record.isDeleted) {
        return NextResponse.json({ found: false as const });
      }
      return NextResponse.json({
        found: true as const,
        id: record.id,
        hasCaptions: record.hasCaptions,
      });
    }

    const limitRaw = url.searchParams.get("limit");
    const offsetRaw = url.searchParams.get("offset");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(limitRaw ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
    );
    const offset = Math.max(0, Number(offsetRaw ?? 0) || 0);

    const persistence = isSupabasePersistenceEnabled() ? "supabase" : "none";
    const { items, total } = await listPipelineVideosPage({ limit, offset });

    return NextResponse.json({
      items,
      total,
      limit,
      offset,
      persistence,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list pipeline videos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await softDeletePipelineVideo(id);
    return NextResponse.json({ ok: true as const });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    if (message === "Video not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
