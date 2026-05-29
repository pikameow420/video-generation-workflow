"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-800/90 dark:text-red-200/90">
          {error.message || "The page failed to render."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          className="mt-4 rounded-full border-red-300 text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/50"
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
