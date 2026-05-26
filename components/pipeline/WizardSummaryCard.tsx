"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

export type WizardSummaryCardProps = {
  title: string;
  detail: string;
  thumbnailUrl?: string;
  onEdit: () => void;
};

export function WizardSummaryCard({
  title,
  detail,
  thumbnailUrl,
  onEdit,
}: WizardSummaryCardProps) {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Complete
              </span>
              <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              className="h-12 w-12 rounded-lg border object-cover dark:border-zinc-800"
              alt="Thumbnail"
            />
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Change
          </Button>
        </div>
      </div>
    </Card>
  );
}
