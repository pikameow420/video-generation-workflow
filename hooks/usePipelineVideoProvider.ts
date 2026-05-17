"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { VideoProvider } from "@/lib/schemas";

import {
  VIDEO_PROVIDER_STORAGE_KEY,
  readStoredVideoProvider,
} from "@/lib/pipeline/wizard-utils";
import { getJson } from "@/lib/api/client";
import { videoConfigResponseSchema } from "@/lib/schemas";

export type VideoProviderEnvState = {
  loaded: boolean;
  atlasConfigured: boolean;
  muapiConfigured: boolean;
};

/** Fetch `/api/video/config`, merge with persisted provider, expose `persistVideoProvider` (+ clear MUAPI-only extras when switching away). */
export function usePipelineVideoProvider(onLeaveMuapi: () => void): {
  videoProvider: VideoProvider;
  persistVideoProvider: (next: VideoProvider) => void;
  videoProviderEnv: VideoProviderEnvState;
  videoBackendReady: boolean;
} {
  const [videoProvider, setVideoProvider] = useState<VideoProvider>("atlas");
  const [videoProviderEnv, setVideoProviderEnv] = useState<VideoProviderEnvState>({
    loaded: false,
    atlasConfigured: false,
    muapiConfigured: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await getJson(
          "/api/video/config",
          "Video provider config failed",
          videoConfigResponseSchema,
        );
        if (cancelled) return;

        const stored = readStoredVideoProvider();
        let next: VideoProvider = stored ?? cfg.defaultProvider;

        if (next === "atlas" && !cfg.atlasConfigured && cfg.muapiConfigured) {
          next = "muapi";
        }
        if (next === "muapi" && !cfg.muapiConfigured && cfg.atlasConfigured) {
          next = "atlas";
        }

        setVideoProvider(next);
        try {
          localStorage.setItem(VIDEO_PROVIDER_STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        setVideoProviderEnv({
          loaded: true,
          atlasConfigured: cfg.atlasConfigured,
          muapiConfigured: cfg.muapiConfigured,
        });
      } catch {
        if (!cancelled) {
          setVideoProviderEnv((prev) => ({ ...prev, loaded: true }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistVideoProvider = useCallback(
    (next: VideoProvider) => {
      setVideoProvider(next);
      if (next !== "muapi") {
        onLeaveMuapi();
      }
      try {
        localStorage.setItem(VIDEO_PROVIDER_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [onLeaveMuapi],
  );

  const videoBackendReady = useMemo(() => {
    if (!videoProviderEnv.loaded) return false;
    return (
      (videoProvider === "atlas" && videoProviderEnv.atlasConfigured) ||
      (videoProvider === "muapi" && videoProviderEnv.muapiConfigured)
    );
  }, [videoProvider, videoProviderEnv]);

  return {
    videoProvider,
    persistVideoProvider,
    videoProviderEnv,
    videoBackendReady,
  };
}
