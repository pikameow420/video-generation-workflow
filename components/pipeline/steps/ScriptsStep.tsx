"use client";

import { ChangeEvent } from "react";

import type {
  ReferenceImage,
  ScriptOption,
} from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type ScriptsStepProps = {
  scripts: ScriptOption[] | null;
  selectedId: string | null;
  selectedScript: ScriptOption | null;
  scriptEdit: { title: string; body: string };
  artDirection: string;
  busy: boolean;
  referenceImages: ReferenceImage[];
  selectedReferenceUrls: string[];
  loadingReferenceImages: boolean;
  onPickScript: (id: string) => void;
  onCreateNewScript: () => void;
  onScriptEditChange: (next: { title: string; body: string }) => void;
  onArtDirectionChange: (v: string) => void;
  onUploadReference: (e: ChangeEvent<HTMLInputElement>) => void;
  onRefreshReferences: () => void;
  onSelectReferenceImage: (url: string) => void;
  onRemoveReferenceImage: (url: string) => void;
  onDeleteReferenceImage: (item: ReferenceImage) => void;
  onUseSelectedReferenceDirectly: () => void;
  onGenerateSheet: () => void;
};

export function ScriptsStep({
  scripts,
  selectedId,
  selectedScript,
  scriptEdit,
  artDirection,
  busy,
  referenceImages,
  selectedReferenceUrls,
  loadingReferenceImages,
  onPickScript,
  onCreateNewScript,
  onScriptEditChange,
  onArtDirectionChange,
  onUploadReference,
  onRefreshReferences,
  onSelectReferenceImage,
  onRemoveReferenceImage,
  onDeleteReferenceImage,
  onUseSelectedReferenceDirectly,
  onGenerateSheet,
}: ScriptsStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            2
          </div>
          <CardTitle className="text-xl">
            {scripts ? "Pick and polish a script" : "Review your script"}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        {scripts ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {scripts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickScript(s.id)}
                className={cn(
                  "rounded-xl border p-4 text-left text-sm transition-all",
                  selectedId === s.id
                    ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:ring-zinc-100"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50",
                )}
              >
                <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
                  {s.title}
                </span>
                <span className="mt-2 line-clamp-3 leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {s.body}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedScript || !scripts ? (
          <div className="space-y-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/30">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Selected Script (Editable)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreateNewScript}
                className="rounded-full"
              >
                Create New Script
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

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="art-direction-input">Art Direction for Visuals (Optional)</Label>
          <Input
            id="art-direction-input"
            value={artDirection}
            onChange={(e) => onArtDirectionChange(e.target.value)}
            placeholder="e.g. flat vector mascot, soft 3D, cyberpunk palette"
          />
          <p className="text-xs text-zinc-500">Image generation is billed separately.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Reuse Or Upload Your Own Photo
          </p>
          <p className="text-xs text-zinc-500">
            Selected references steer character sheet generation only. Video uses the
            sheet from the next step.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
              Upload Reference
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={onUploadReference}
                disabled={busy}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={onRefreshReferences}
              disabled={busy || loadingReferenceImages}
              className="rounded-full"
            >
              {loadingReferenceImages ? "Refreshing..." : "Refresh Library"}
            </Button>
          </div>
          {referenceImages.length ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {referenceImages.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border transition",
                    selectedReferenceUrls.includes(item.url)
                      ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectReferenceImage(item.url)}
                    className="w-full text-left transition hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.originalName}
                      className="h-24 w-full object-cover"
                    />
                    <span className="block truncate px-2 py-1 text-xs text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
                      {selectedReferenceUrls.includes(item.url) ? "Selected - " : ""}
                      {item.originalName}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Delete ${item.originalName} from library`}
                    className={cn(
                      "absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full",
                      "bg-black/60 text-white shadow-sm transition-opacity hover:bg-black/80",
                      "pointer-events-none opacity-0",
                      "focus-visible:pointer-events-auto focus-visible:opacity-100",
                      "group-hover:pointer-events-auto group-hover:opacity-100",
                      "disabled:pointer-events-none disabled:opacity-40",
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteReferenceImage(item);
                    }}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              No saved references yet. Upload one to reuse it later.
            </p>
          )}
          {selectedReferenceUrls.length ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                Selected references (remove individually):
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedReferenceUrls.map((url) => {
                  const label =
                    referenceImages.find((item) => item.url === url)?.originalName ??
                    url.split("/").pop() ??
                    "reference";
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => onRemoveReferenceImage(url)}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <span className="max-w-[180px] truncate">{label}</span>
                      <span aria-hidden>×</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onUseSelectedReferenceDirectly}
              disabled={busy || !selectedReferenceUrls.length}
              className="rounded-full"
            >
              Use Selected Reference For Video
            </Button>
            {selectedReferenceUrls.length ? (
              <span className="text-xs text-zinc-500">
                {selectedReferenceUrls.length} reference
                {selectedReferenceUrls.length > 1 ? "s" : ""} selected
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            disabled={busy || !scriptEdit.title.trim() || !scriptEdit.body.trim()}
            onClick={onGenerateSheet}
            className="rounded-full px-6"
          >
            {busy ? (
              <>
                <Spinner className="mr-2 h-4 w-4" /> Generating Art...
              </>
            ) : (
              "Generate Character Sheet"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
