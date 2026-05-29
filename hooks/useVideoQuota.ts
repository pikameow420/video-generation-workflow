"use client";

import { useCallback, useEffect, useState } from "react";

import { getJson } from "@/lib/api/client";
import { videoQuotaResponseSchema, type VideoQuotaResponse } from "@/lib/schemas";

const defaultQuota: VideoQuotaResponse = {
  exempt: false,
  used: 0,
  limit: 1,
  canStart: true,
};

export function useVideoQuota(enabled: boolean) {
  const [quota, setQuota] = useState<VideoQuotaResponse>(defaultQuota);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await getJson(
        "/api/video/quota",
        "Failed to load video quota",
        videoQuotaResponseSchema,
      );
      setQuota(data);
    } catch {
      setQuota(defaultQuota);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...quota, loading, refresh };
}
