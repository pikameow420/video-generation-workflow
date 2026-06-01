"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const isNotice = variant === "notice";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent className="rounded-2xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isNotice ? "Your free video export" : "No video exports left"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {isNotice ? (
                <>
                  <p>
                    This account includes one free 15-second video. You can
                    generate topics, scripts, and visual sheets as often as you
                    like. Only the final video export counts toward the limit.
                  </p>
                  <p>
                    Team emails that start with{" "}
                    <span className="font-medium text-foreground">advit</span>{" "}
                    are not limited.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    You have already used your free 15-second video on this
                    account.
                  </p>
                  <p>
                    Sign in with a team account if you have one, or reach out if
                    you need more exports.
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isNotice ? (
            <>
              <AlertDialogCancel>Maybe later</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onContinue?.();
                }}
              >
                Got it, continue
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction>Understood</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
