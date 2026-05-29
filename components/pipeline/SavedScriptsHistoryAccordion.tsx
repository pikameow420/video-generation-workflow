"use client";

import type { SavedScript } from "@/components/pipeline/types";
import { scriptHistoryBadgeClass } from "@/components/pipeline/ScriptHistoryEntryRow";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SavedScriptsHistoryAccordionProps = {
  scripts: SavedScript[];
  /** Controlled open item id; use "" when none open. */
  value: string;
  onValueChange: (next: string) => void;
  onConfirm: (script: SavedScript) => void;
};

const CLOSED_PREVIEW_MAX_CHARS = 60;

function scriptPreviewSnippet(body: string, maxChars = CLOSED_PREVIEW_MAX_CHARS): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  return `${flat.slice(0, maxChars).trimEnd()}…`;
}

function SavedScriptBadge({ source }: { source: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        scriptHistoryBadgeClass.saved,
      )}
    >
      {source}
    </span>
  );
}

export function SavedScriptsHistoryAccordion({
  scripts,
  value,
  onValueChange,
  onConfirm,
}: SavedScriptsHistoryAccordionProps) {
  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={(next) => onValueChange(next ?? "")}
      className="space-y-2"
    >
      {scripts.map((script) => {
        const isOpen = value === script.id;

        return (
          <AccordionItem
            key={script.id}
            value={script.id}
            className="overflow-hidden rounded-2xl border border-zinc-200 border-b bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <AccordionTrigger
              className={cn(
                "px-3 py-3 hover:no-underline",
                "rounded-none bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1.5 text-left">
                <span className="line-clamp-1 font-semibold text-zinc-900 dark:text-zinc-100">
                  {script.title}
                </span>
                <SavedScriptBadge source={script.source} />
                {!isOpen ? (
                  <p className="min-w-0 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                    {scriptPreviewSnippet(script.body)}
                  </p>
                ) : null}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-3 pb-3">
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                {script.body}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-w-0 flex-1 rounded-full"
                  onClick={() => onValueChange("")}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-w-0 flex-1 rounded-full px-4"
                  onClick={() => onConfirm(script)}
                >
                  Use this script
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
