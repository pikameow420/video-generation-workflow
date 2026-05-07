"use client";

import { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { ScriptMode } from "@/components/pipeline/types";

type TopicStepProps = {
  scriptMode: ScriptMode;
  busy: boolean;
  topic: string;
  tone: string;
  audience: string;
  notes: string;
  basePrompt: string;
  scriptEdit: { title: string; body: string };
  saveManualScript: boolean;
  onScriptModeChange: (next: ScriptMode) => void;
  onTopicChange: (v: string) => void;
  onToneChange: (v: string) => void;
  onAudienceChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onBasePromptChange: (v: string) => void;
  onScriptEditChange: (next: { title: string; body: string }) => void;
  onSaveManualScriptChange: (next: boolean) => void;
  onGenerateScripts: () => void;
  onContinueManual: () => void;
  onUploadScriptFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onLoadSavedScripts: () => void;
  onManualBodyInput: () => void;
};

export function TopicStep({
  scriptMode,
  busy,
  topic,
  tone,
  audience,
  notes,
  basePrompt,
  scriptEdit,
  saveManualScript,
  onScriptModeChange,
  onTopicChange,
  onToneChange,
  onAudienceChange,
  onNotesChange,
  onBasePromptChange,
  onScriptEditChange,
  onSaveManualScriptChange,
  onGenerateScripts,
  onContinueManual,
  onUploadScriptFile,
  onLoadSavedScripts,
  onManualBodyInput,
}: TopicStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white py-0 shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            1
          </div>
          <CardTitle className="text-xl">What is this video about?</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => onScriptModeChange("generate")}
            variant={scriptMode === "generate" ? "default" : "outline"}
            className="rounded-full"
          >
            Generate Scripts
          </Button>
          <Button
            type="button"
            onClick={() => {
              onScriptModeChange("manual");
              onLoadSavedScripts();
            }}
            variant={scriptMode === "manual" ? "default" : "outline"}
            className="rounded-full"
          >
            Use My Own Script
          </Button>
        </div>

        {scriptMode === "generate" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="topic-input">
                Topic <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="topic-input"
                className="min-h-[88px]"
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="e.g. Why cold brew tastes smoother than iced coffee"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tone-input">Tone</Label>
                <Input
                  id="tone-input"
                  value={tone}
                  onChange={(e) => onToneChange(e.target.value)}
                  placeholder="Witty, calm expert, hype..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="audience-input">Audience</Label>
                <Input
                  id="audience-input"
                  value={audience}
                  onChange={(e) => onAudienceChange(e.target.value)}
                  placeholder="e.g. first-time home baristas"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes-input">Notes</Label>
              <Input
                id="notes-input"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Avoid brand names, CTA at end, etc."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="base-prompt-input">
                Base Prompt (Persistent instructions)
              </Label>
              <Textarea
                id="base-prompt-input"
                className="min-h-[88px]"
                value={basePrompt}
                onChange={(e) => onBasePromptChange(e.target.value)}
                placeholder="e.g. Always be concise, use Gen Z slang, keep it funny"
              />
            </div>

            <Button
              type="button"
              disabled={busy || !topic.trim()}
              onClick={onGenerateScripts}
              className="rounded-full px-6"
            >
              {busy ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" /> Generating Scripts...
                </>
              ) : (
                "Generate 4 Scripts"
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="script-title-input">Script Title</Label>
              <Input
                id="script-title-input"
                value={scriptEdit.title}
                onChange={(e) =>
                  onScriptEditChange({
                    title: e.target.value,
                    body: scriptEdit.body,
                  })
                }
                placeholder="e.g. 3 reasons cold brew feels smoother"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="script-body-input">
                Script Body <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="script-body-input"
                className="min-h-[140px]"
                value={scriptEdit.body}
                onChange={(e) => {
                  onManualBodyInput();
                  onScriptEditChange({
                    title: scriptEdit.title,
                    body: e.target.value,
                  });
                }}
                placeholder="Paste your script here..."
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
                Upload .txt/.md
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  onChange={onUploadScriptFile}
                  disabled={busy}
                />
              </label>
              <span className="text-xs text-muted-foreground">Max 256KB</span>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={saveManualScript}
                onChange={(e) => onSaveManualScriptChange(e.target.checked)}
              />
              Save this script to library
            </label>
            <Button
              type="button"
              disabled={busy || !scriptEdit.body.trim()}
              onClick={onContinueManual}
              className="rounded-full px-6"
            >
              {busy ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" /> Continuing...
                </>
              ) : (
                "Continue to Character Sheet"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
