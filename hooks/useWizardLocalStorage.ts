"use client";

import { useEffect, useState } from "react";

export function useWizardLocalStorage<T>({
  storageKey,
  restore,
  snapshot,
}: {
  storageKey: string;
  restore: (snapshot: Partial<T>) => void;
  snapshot: T;
}) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        restore(JSON.parse(raw) as Partial<T>);
      }
    } catch {
      // Ignore malformed snapshots.
    } finally {
      setHydrated(true);
    }
  }, [restore, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [hydrated, snapshot, storageKey]);
}
