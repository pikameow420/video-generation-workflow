"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScriptHistoryBadgeVariant =
  | "batch"
  | "current"
  | "sheet"
  | "saved";

const badgeClass: Record<ScriptHistoryBadgeVariant, string> = {
  batch:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
  current:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  sheet:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  saved:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
};

const primaryRowClass =
  "h-auto w-full flex-col items-start gap-0 rounded-2xl border border-zinc-200 bg-white p-3 text-left text-xs font-normal shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

const alternateRowClass =
  "h-auto w-full flex-col items-start gap-0 rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-left text-xs font-normal hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:hover:bg-sky-900/40";

type ScriptHistoryEntryRowProps = {
  title: string;
  body: string;
  badge: { label: string; variant: ScriptHistoryBadgeVariant };
  onSelect: () => void;
  reserveToggleSpace?: boolean;
};

export function ScriptHistoryEntryRow({
  title,
  body,
  badge,
  onSelect,
  reserveToggleSpace = false,
}: ScriptHistoryEntryRowProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(primaryRowClass, reserveToggleSpace && "pr-28")}
      onClick={onSelect}
    >
      <span className="line-clamp-1 w-full font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </span>
      <span className="line-clamp-2 w-full font-normal text-zinc-600 dark:text-zinc-400">
        {body}
      </span>
      <span
        className={cn(
          "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          badgeClass[badge.variant],
        )}
      >
        {badge.label}
      </span>
    </Button>
  );
}

export function ScriptHistoryAlternateRow({
  title,
  body,
  onSelect,
}: {
  title: string;
  body: string;
  onSelect: () => void;
}) {
  return (
    <Button type="button" variant="outline" className={alternateRowClass} onClick={onSelect}>
      <span className="line-clamp-1 w-full font-semibold text-sky-900 dark:text-sky-200">
        {title}
      </span>
      <span className="line-clamp-2 w-full font-normal text-sky-700 dark:text-sky-300">
        {body}
      </span>
    </Button>
  );
}

export function ScriptHistoryExpandToggle({
  expanded,
  count,
  onToggle,
  className,
}: {
  expanded: boolean;
  count: number;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn(
        "absolute right-2 top-1/2 h-auto -translate-y-1/2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
      onClick={onToggle}
    >
      {expanded ? "Hide" : "View"} {count}
    </Button>
  );
}
