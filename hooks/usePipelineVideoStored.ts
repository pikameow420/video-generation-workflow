"use client";

import { useEffect, useState } from "react";

import { getJson } from "@/lib/api/client";
import { pipelineVideoLookupResponseSchema } from "@/lib/schemas";

/** Whether a completed job has a row in Supabase or the local captioned-video index. */
export function usePipelineVideoStored(
  predictionId: string | null | undefined,
  enabled: boolean,
  /** Bumps lookup after burn/caption updates the stored row. */
  refreshKey = "",
): boolean {
  const [stored, setStored] = useState(false);

  const active = enabled && Boolean(predictionId?.trim());

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const id = predictionId!.trim();

    void (async () => {
      setStored(false);
      try {
        const data = await getJson(
          `/api/pipeline-videos?predictionId=${encodeURIComponent(id)}`,
          "Could not check video library",
          pipelineVideoLookupResponseSchema,
        );
        if (!cancelled) setStored(data.found);
      } catch {
        if (!cancelled) setStored(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [predictionId, active, refreshKey]);

  return active ? stored : false;
}
