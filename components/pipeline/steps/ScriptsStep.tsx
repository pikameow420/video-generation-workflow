"use client";

import type { ScriptOption } from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ScriptsStepProps = {
  scripts: ScriptOption[] | null;
  selectedId: string | null;
  selectedScript: ScriptOption | null;
  scriptEdit: { title: string; body: string };
  busy: boolean;
  onPickScript: (id: string) => void;
  onCreateNewScript: () => void;
  onScriptEditChange: (next: { title: string; body: string }) => void;
  onContinueToCharacter: () => void;
};

export function ScriptsStep({
  scripts,
  selectedId,
  selectedScript,
  scriptEdit,
  busy,
  onPickScript,
  onCreateNewScript,
  onScriptEditChange,
  onContinueToCharacter,
}: ScriptsStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            2
          </div>
          <CardTitle className="text-xl">
            {scripts ? "Choose a script to refine" : "Review your script"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        {scripts ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {scripts.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="outline"
                onClick={() => onPickScript(s.id)}
                className={cn(
                  "h-auto w-full flex-col items-start gap-0 rounded-xl p-4 text-left text-sm font-normal",
                  selectedId === s.id
                    ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50",
                )}
              >
                <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
                  {s.title}
                </span>
                <span className="mt-2 line-clamp-3 leading-relaxed font-normal text-zinc-600 dark:text-zinc-400">
                  {s.body}
                </span>
              </Button>
            ))}
          </div>
        ) : null}

        {selectedScript || !scripts ? (
          <div className="space-y-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Your script (editable)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreateNewScript}
                className="rounded-full"
              >
                Start a blank script
              </Button>
            </div>
            <Input
              value={scriptEdit.title}
              onChange={(e) =>
                onScriptEditChange({
                  title: e.target.value,
                  body: scriptEdit.body,
                })
              }
            />
            <Textarea
              className="min-h-[140px]"
              value={scriptEdit.body}
              onChange={(e) =>
                onScriptEditChange({
                  title: scriptEdit.title,
                  body: e.target.value,
                })
              }
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            disabled={busy || !scriptEdit.title.trim() || !scriptEdit.body.trim()}
            onClick={onContinueToCharacter}
            className="rounded-full px-6"
          >
            Continue to character
          </Button>
          <p className="text-xs text-zinc-500">
            Next: choose references, look, and optional voice for this run.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
