"use client";

import type {
  ScriptOption,
  SheetScriptHistoryEntry,
} from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type ScriptHistorySidebarProps = {
  isOpen: boolean;
  loadingSavedScripts: boolean;
  savedScriptsLoaded: boolean;
  currentBatchPrimaryScript: ScriptOption | null;
  currentBatchRemainingScripts: ScriptOption[];
  expandedHistoryId: string | null;
  sheetScriptHistory: SheetScriptHistoryEntry[];
  onToggle: () => void;
  onRefresh: () => void;
  onPickCurrentBatchScript: (id: string) => void;
  onApplyHistoryScript: (script: { title: string; body: string }) => void;
  onExpandedHistoryIdChange: (next: string | null) => void;
};

export function ScriptHistorySidebar({
  isOpen,
  loadingSavedScripts,
  savedScriptsLoaded,
  currentBatchPrimaryScript,
  currentBatchRemainingScripts,
  expandedHistoryId,
  sheetScriptHistory,
  onToggle,
  onRefresh,
  onPickCurrentBatchScript,
  onApplyHistoryScript,
  onExpandedHistoryIdChange,
}: ScriptHistorySidebarProps) {
  const hasScriptsToShow = Boolean(
    currentBatchPrimaryScript || sheetScriptHistory.length,
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
        <Card className="w-[320px] gap-4 rounded-3xl border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-black/20">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Script History
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Selected script visible, alternates tucked below.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onRefresh}
              disabled={loadingSavedScripts}
              className="rounded-full"
            >
              {loadingSavedScripts ? "..." : "Refresh"}
            </Button>
          </div>

          {!hasScriptsToShow && !savedScriptsLoaded && !loadingSavedScripts ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              className="w-full rounded-lg"
            >
              Load previous scripts
            </Button>
          ) : null}

          <ScrollArea className="max-h-[62vh] pr-1">
            {currentBatchPrimaryScript ? (
              <div className="space-y-2">
                <div className="group space-y-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => onPickCurrentBatchScript(currentBatchPrimaryScript.id)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white p-3 pr-28 text-left text-xs shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <p className="line-clamp-1 font-semibold text-zinc-900 dark:text-zinc-100">
                        {currentBatchPrimaryScript.title}
                      </p>
                      <p className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                        {currentBatchPrimaryScript.body}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                        Current batch
                      </span>
                    </button>
                    {currentBatchRemainingScripts.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          onExpandedHistoryIdChange(
                            expandedHistoryId === "__current_batch__"
                              ? null
                              : "__current_batch__",
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {expandedHistoryId === "__current_batch__" ? "Hide" : "View"}{" "}
                        {currentBatchRemainingScripts.length}
                      </button>
                    ) : null}
                  </div>

                  {expandedHistoryId === "__current_batch__" ? (
                    <div className="space-y-1.5 pl-3">
                      {currentBatchRemainingScripts.map((remaining) => (
                        <button
                          key={`current-batch-remaining-${remaining.id}`}
                          type="button"
                          onClick={() => onPickCurrentBatchScript(remaining.id)}
                          className="w-full rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-left text-xs transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:hover:bg-sky-900/40"
                        >
                          <p className="line-clamp-1 font-semibold text-sky-900 dark:text-sky-200">
                            {remaining.title}
                          </p>
                          <p className="line-clamp-2 text-sky-700 dark:text-sky-300">
                            {remaining.body}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : sheetScriptHistory.length ? (
              <div className="space-y-2">
                {sheetScriptHistory.map((item) => (
                  <div key={item.id} className="group space-y-1.5">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => onApplyHistoryScript(item.selectedScript)}
                        className="w-full rounded-2xl border border-zinc-200 bg-white p-3 pr-28 text-left text-xs shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        <p className="line-clamp-1 font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.selectedScript.title}
                        </p>
                        <p className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                          {item.selectedScript.body}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Sheet generated
                        </span>
                      </button>
                      {item.remainingScripts.length ? (
                        <button
                          type="button"
                          onClick={() =>
                            onExpandedHistoryIdChange(
                              expandedHistoryId === item.id ? null : item.id,
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {expandedHistoryId === item.id ? "Hide" : "View"}{" "}
                          {item.remainingScripts.length}
                        </button>
                      ) : null}
                    </div>

                    {expandedHistoryId === item.id ? (
                      <div className="space-y-1.5 pl-3">
                        {item.remainingScripts.map((remaining, index) => (
                          <button
                            key={`${item.id}-remaining-${index}`}
                            type="button"
                            onClick={() => onApplyHistoryScript(remaining)}
                            className="w-full rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-left text-xs transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:hover:bg-sky-900/40"
                          >
                            <p className="line-clamp-1 font-semibold text-sky-900 dark:text-sky-200">
                              {remaining.title}
                            </p>
                            <p className="line-clamp-2 text-sky-700 dark:text-sky-300">
                              {remaining.body}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : savedScriptsLoaded && !loadingSavedScripts ? (
              <p className="text-xs text-zinc-500">
                No script has completed sheet generation yet. Generate a batch to see your
                selected script here.
              </p>
            ) : null}
          </ScrollArea>
        </Card>
      ) : null}
    </div>
  );
}
