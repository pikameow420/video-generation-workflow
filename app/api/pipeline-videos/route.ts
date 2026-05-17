import { NextResponse } from "next/server";
import { listPipelineVideosPage } from "@/lib/uploads/pipeline-video-store";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
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
