"use client";

import { useMemo } from "react";

import {
  ScriptHistoryAlternateRow,
  ScriptHistoryEntryRow,
  ScriptHistoryExpandToggle,
} from "@/components/pipeline/ScriptHistoryEntryRow";
import type {
  SavedScript,
  ScriptOption,
  SheetScriptHistoryEntry,
} from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { dedupeByTitleBody } from "@/lib/scripts/dedupe";

type ScriptHistorySidebarProps = {
  isOpen: boolean;
  loadingSavedScripts: boolean;
  savedScriptsLoaded: boolean;
  savedScripts: SavedScript[];
  currentBatchPrimaryScript: ScriptOption | null;
  currentBatchRemainingScripts: ScriptOption[];
  activeScript: { title: string; body: string } | null;
  expandedHistoryId: string | null;
  sheetScriptHistory: SheetScriptHistoryEntry[];
  onToggle: () => void;
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
  currentBatchPrimaryScript,
  currentBatchRemainingScripts,
  activeScript,
  expandedHistoryId,
  sheetScriptHistory,
  onToggle,
  onRefresh,
  onPickCurrentBatchScript,
  onApplyHistoryScript,
  onApplySavedScript,
  onExpandedHistoryIdChange,
}: ScriptHistorySidebarProps) {
  const uniqueSavedScripts = useMemo(
    () => dedupeByTitleBody(savedScripts),
    [savedScripts],
  );
  const hasSheetHistory = sheetScriptHistory.length > 0;
  const hasSavedScripts = uniqueSavedScripts.length > 0;
  const hasScriptsToShow = Boolean(
    currentBatchPrimaryScript ||
      activeScript ||
      hasSheetHistory ||
      hasSavedScripts,
  );

  return (
    <div className="fixed right-8 top-20 z-30 hidden lg:flex lg:flex-col lg:items-end lg:gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="rounded-full bg-white shadow-sm dark:bg-zinc-950"
      >
        {isOpen ? "Hide Scripts" : "Show Scripts"}
      </Button>

      {isOpen ? (
        <Card className="flex w-[320px] max-h-[min(80vh,640px)] flex-col overflow-hidden rounded-3xl border-zinc-200 bg-white p-0 shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-black/20">
          <div className="shrink-0 space-y-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Script History
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                  Scripts used with a frame sheet; saved library scripts below.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onRefresh}
                disabled={loadingSavedScripts}
                className="shrink-0 rounded-full"
              >
                {loadingSavedScripts ? "..." : "Load saved"}
              </Button>
            </div>

            {!hasScriptsToShow && !savedScriptsLoaded && !loadingSavedScripts ? (
              <Button
                type="button"
                variant="outline"
                onClick={onRefresh}
                className="w-full rounded-lg"
              >
                Load saved scripts
              </Button>
            ) : null}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">
              {currentBatchPrimaryScript ? (
                <div className="space-y-2">
                  <div className="group space-y-1.5">
                    <div className="relative">
                      <ScriptHistoryEntryRow
                        title={currentBatchPrimaryScript.title}
                        body={currentBatchPrimaryScript.body}
                        badge={{ label: "Current batch", variant: "batch" }}
                        onSelect={() =>
                          onPickCurrentBatchScript(currentBatchPrimaryScript.id)
                        }
                        reserveToggleSpace={currentBatchRemainingScripts.length > 0}
                      />
                      {currentBatchRemainingScripts.length > 0 ? (
                        <ScriptHistoryExpandToggle
                          expanded={expandedHistoryId === "__current_batch__"}
                          count={currentBatchRemainingScripts.length}
                          onToggle={() =>
                            onExpandedHistoryIdChange(
                              expandedHistoryId === "__current_batch__"
                                ? null
                                : "__current_batch__",
                            )
                          }
                        />
                      ) : null}
                    </div>
                    {expandedHistoryId === "__current_batch__" ? (
                      <div className="space-y-1.5 pl-3">
                        {currentBatchRemainingScripts.map((remaining) => (
                          <ScriptHistoryAlternateRow
                            key={`current-batch-remaining-${remaining.id}`}
                            title={remaining.title}
                            body={remaining.body}
                            onSelect={() => onPickCurrentBatchScript(remaining.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : activeScript ? (
                <ScriptHistoryEntryRow
                  title={activeScript.title}
                  body={activeScript.body}
                  badge={{ label: "Current script", variant: "current" }}
                  onSelect={() => onApplyHistoryScript(activeScript)}
                />
              ) : null}

              {hasSheetHistory ? (
                <div className="space-y-2">
                  {currentBatchPrimaryScript || activeScript ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Sheet generated
                    </p>
                  ) : null}
                  {sheetScriptHistory.map((item) => (
                    <div key={item.id} className="group space-y-1.5">
                      <div className="relative">
                        <ScriptHistoryEntryRow
                          title={item.selectedScript.title}
                          body={item.selectedScript.body}
                          badge={{ label: "Sheet generated", variant: "sheet" }}
                          onSelect={() => onApplyHistoryScript(item.selectedScript)}
                          reserveToggleSpace={item.remainingScripts.length > 0}
                        />
                        {item.remainingScripts.length > 0 ? (
                          <ScriptHistoryExpandToggle
                            expanded={expandedHistoryId === item.id}
                            count={item.remainingScripts.length}
                            onToggle={() =>
                              onExpandedHistoryIdChange(
                                expandedHistoryId === item.id ? null : item.id,
                              )
                            }
                          />
                        ) : null}
                      </div>
                      {expandedHistoryId === item.id ? (
                        <div className="space-y-1.5 pl-3">
                          {item.remainingScripts.map((remaining, index) => (
                            <ScriptHistoryAlternateRow
                              key={`${item.id}-remaining-${index}`}
                              title={remaining.title}
                              body={remaining.body}
                              onSelect={() => onApplyHistoryScript(remaining)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {savedScriptsLoaded && hasSavedScripts ? (
                <div className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Saved scripts
                  </p>
                  {uniqueSavedScripts.map((script) => (
                    <ScriptHistoryEntryRow
                      key={script.id}
                      title={script.title}
                      body={script.body}
                      badge={{ label: script.source, variant: "saved" }}
                      onSelect={() => onApplySavedScript(script)}
                    />
                  ))}
                </div>
              ) : savedScriptsLoaded && !loadingSavedScripts && !hasSavedScripts ? (
                <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
                  No saved scripts in the library yet.
                </p>
              ) : null}

              {!hasScriptsToShow &&
              savedScriptsLoaded &&
              !loadingSavedScripts ? (
                <p className="text-xs text-zinc-500">
                  No scripts in this run yet. History lists scripts that reached a
                  frame sheet or video step; finished videos live in the video library.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </Card>
      ) : null}
    </div>
  );
}
