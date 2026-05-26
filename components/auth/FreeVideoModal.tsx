"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export const FREE_VIDEO_NOTICE_STORAGE_KEY = "free-video-notice-seen";

export function hasSeenFreeVideoNotice(): boolean {
  try {
    return sessionStorage.getItem(FREE_VIDEO_NOTICE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFreeVideoNoticeSeen(): void {
  try {
    sessionStorage.setItem(FREE_VIDEO_NOTICE_STORAGE_KEY, "1");
  } catch {}
}

type FreeVideoModalProps = {
  open: boolean;
  variant: "notice" | "limit";
  onClose: () => void;
  onContinue?: () => void;
};

export function FreeVideoModal({
  open,
  variant,
  onClose,
  onContinue,
}: FreeVideoModalProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open, variant]);

  if (!open) return null;

  const isNotice = variant === "notice";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={isNotice ? onClose : undefined}
        tabIndex={isNotice ? 0 : -1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-video-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2
          id="free-video-modal-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {isNotice ? "Your free video export" : "No video exports left"}
        </h2>
        <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          {isNotice ? (
            <>
              <p>
                This account includes one free 15-second video. You can generate
                topics, scripts, and visual sheets as often as you like—only the
                final video export counts toward the limit.
              </p>
              <p>
                Team emails that start with{" "}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  advit
                </span>{" "}
                are not limited.
              </p>
            </>
          ) : (
            <>
              <p>
                You have already used your free 15-second video on this account.
              </p>
              <p>
                Sign in with a team account if you have one, or reach out if you
                need more exports.
              </p>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {isNotice ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Maybe later
              </Button>
              <Button
                ref={primaryRef}
                type="button"
                onClick={() => {
                  onContinue?.();
                  onClose();
                }}
              >
                Got it, continue
              </Button>
            </>
          ) : (
            <Button ref={primaryRef} type="button" onClick={onClose}>
              Understood
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
