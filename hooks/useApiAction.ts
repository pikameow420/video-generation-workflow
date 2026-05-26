"use client";

import { useCallback } from "react";

export type RunApiAction = (
  action: () => Promise<void>,
  fallbackError: string,
) => Promise<void>;

type ActionOptions = {
  onError: (message: string) => void;
  setBusy: (next: boolean) => void;
  clearError?: () => void;
};

export function useApiAction({ onError, setBusy, clearError }: ActionOptions): RunApiAction {
  return useCallback(
    async (action: () => Promise<void>, fallbackError: string) => {
      if (clearError) clearError();
      try {
        setBusy(true);
        await action();
      } catch (error) {
        onError(error instanceof Error ? error.message : fallbackError);
      } finally {
        setBusy(false);
      }
    },
    [clearError, onError, setBusy],
  );
}
