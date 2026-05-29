"use client";

import { ScriptHistoryPanel } from "@/components/pipeline/ScriptHistoryPanel";
import type {
  SavedScript,
  ScriptOption,
  SheetScriptHistoryEntry,
} from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLgUp } from "@/hooks/useMediaQuery";

export type ScriptHistorySidebarProps = {
  isOpen: boolean;
  loadingSavedScripts: boolean;
  savedScriptsLoaded: boolean;
  savedScripts: SavedScript[];
  sheetScriptHistory: SheetScriptHistoryEntry[];
  currentBatchPrimaryScript: ScriptOption | null;
  currentBatchRemainingScripts: ScriptOption[];
  activeScript: { title: string; body: string } | null;
  expandedHistoryId: string | null;
  onToggle: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onPickCurrentBatchScript: (id: string) => void;
  onApplyHistoryScript: (script: { title: string; body: string }) => void;
  onApplySavedScript: (script: SavedScript) => void;
  onExpandedHistoryIdChange: (next: string | null) => void;
};

export function ScriptHistorySidebar({
  isOpen,
  loadingSavedScripts,
  savedScriptsLoaded,
  savedScripts,
  sheetScriptHistory,
  currentBatchPrimaryScript,
  currentBatchRemainingScripts,
  activeScript,
  expandedHistoryId,
  onToggle,
  onClose,
  onRefresh,
  onPickCurrentBatchScript,
  onApplyHistoryScript,
  onApplySavedScript,
  onExpandedHistoryIdChange,
}: ScriptHistorySidebarProps) {
  const lgUp = useLgUp();
  const panelProps = {
    loadingSavedScripts,
    savedScriptsLoaded,
    savedScripts,
    sheetScriptHistory,
    currentBatchPrimaryScript,
    currentBatchRemainingScripts,
    activeScript,
    expandedHistoryId,
    onRefresh,
    onPickCurrentBatchScript,
    onApplyHistoryScript,
    onApplySavedScript,
    onExpandedHistoryIdChange,
  };

  return (
    <>
      {/* Desktop only — mobile uses hamburger → My Script History */}
      <div className="fixed right-4 top-20 z-30 hidden flex-col items-end gap-3 sm:right-6 lg:right-8 lg:flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="rounded-full bg-white shadow-sm dark:bg-zinc-950"
          aria-expanded={isOpen}
        >
          {isOpen ? "Hide Scripts" : "Show Scripts"}
        </Button>
      </div>

      {/* Mobile/tablet drawer — `open` must stay false at lg+ (see useLgUp / Tailwind lg) or overlay dims desktop */}
      <Sheet
        open={isOpen && !lgUp}
        onOpenChange={(open) => {
          if (open) return;
          onClose();
        }}
      >
        <SheetContent
          side="right"
          className="w-full max-w-full gap-0 p-0 lg:hidden"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Script History</SheetTitle>
          <SheetDescription className="sr-only">
            Scripts used with a frame sheet; saved library scripts below.
          </SheetDescription>
          <ScriptHistoryPanel {...panelProps} onClose={onClose} />
        </SheetContent>
      </Sheet>

      {/* Desktop: fixed card */}
      {isOpen ? (
        <Card className="fixed right-8 top-[7.25rem] z-30 hidden h-[min(80vh,640px)] w-[320px] flex-col overflow-hidden rounded-3xl border-zinc-200 bg-white p-0 shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-black/20 lg:flex">
          <ScriptHistoryPanel {...panelProps} />
        </Card>
      ) : null}
    </>
  );
}
