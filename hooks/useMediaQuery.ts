"use client";

import { useSyncExternalStore } from "react";

/** Matches Tailwind `lg` (1024px). */
export const LG_UP_MEDIA_QUERY = "(min-width: 1024px)";

export function useMediaQuery(
  query: string,
  /** SSR snapshot when `window` is unavailable. */
  serverSnapshot = false,
): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}

/** True at Tailwind `lg` and above. Defaults to desktop during SSR. */
export function useLgUp(): boolean {
  return useMediaQuery(LG_UP_MEDIA_QUERY, true);
}
