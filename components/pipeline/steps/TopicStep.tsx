"use client";

import { ChangeEvent, useState } from "react";

import type { CreatorPreset } from "@/lib/pipeline/creator-presets";
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
  brandKit: string;
  presets: CreatorPreset[];
  scriptEdit: { title: string; body: string };
  saveManualScript: boolean;
  onScriptModeChange: (next: ScriptMode) => void;
  onTopicChange: (v: string) => void;
  onToneChange: (v: string) => void;
  onAudienceChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onBasePromptChange: (v: string) => void;
  onBrandKitChange: (v: string) => void;
  onApplyPreset: (preset: CreatorPreset) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
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
  brandKit,
  presets,
  scriptEdit,
  saveManualScript,
  onScriptModeChange,
  onTopicChange,
  onToneChange,
  onAudienceChange,
  onNotesChange,
  onBasePromptChange,
  onBrandKitChange,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onScriptEditChange,
  onSaveManualScriptChange,
  onGenerateScripts,
  onContinueManual,
  onUploadScriptFile,
  onLoadSavedScripts,
  onManualBodyInput,
}: TopicStepProps) {
  const [presetPickerKey, setPresetPickerKey] = useState(0);
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const [presetToDeleteId, setPresetToDeleteId] = useState("");

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
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
            <div className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Presets
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Save or load topic, tone, audience, notes, brand kit, base prompt, and
                art direction for the next steps.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Load preset
                  </label>
                  <select
                    key={presetPickerKey}
                    className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      const p = presets.find((x) => x.id === id);
                      if (p) onApplyPreset(p);
                      setPresetPickerKey((k) => k + 1);
                    }}
                  >
                    <option value="">Choose saved preset…</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-0 flex-[2] flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Save as
                    </label>
                    <Input
                      className="h-9"
                      value={presetNameDraft}
                      onChange={(e) => setPresetNameDraft(e.target.value)}
                      placeholder="e.g. Coffee explainers"
                      maxLength={80}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 shrink-0 rounded-full"
                    disabled={busy}
                    onClick={() => {
                      onSavePreset(presetNameDraft);
                    }}
                  >
                    Save preset
                  </Button>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Remove preset
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      value={presetToDeleteId}
                      onChange={(e) => setPresetToDeleteId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    disabled={busy || !presetToDeleteId}
                    onClick={() => {
                      onDeletePreset(presetToDeleteId);
                      setPresetToDeleteId("");
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>

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
              <Label htmlFor="brand-kit-input">Brand kit</Label>
              <Textarea
                id="brand-kit-input"
                className="min-h-[100px]"
                value={brandKit}
                onChange={(e) => onBrandKitChange(e.target.value)}
                placeholder="Voice (e.g. first person, playful expert). Words to avoid. How to sign off or say CTA."
                maxLength={8000}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Applied when you generate scripts—kept separate from the Base Prompt below.
              </p>
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
