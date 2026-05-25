"use client";

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  Clapperboard,
  FileText,
  LayoutGrid,
  Lightbulb,
  User,
} from "lucide-react";

import type { Step } from "@/components/pipeline/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  WIZARD_STEPS,
  type WizardStepUiState,
} from "@/lib/pipeline/wizard-utils";

const STEP_ICONS: Record<Step, LucideIcon> = {
  topic: Lightbulb,
  scripts: FileText,
  character: User,
  sheet: LayoutGrid,
  video: Clapperboard,
};

function stepTooltipReason(
  state: WizardStepUiState,
  busy: boolean,
): string | undefined {
  if (!state.accessible && state.disabledReason) return state.disabledReason;
  if (busy && state.accessible)
    return "Wait for the current request before changing steps.";
  return undefined;
}

export type PipelineStepperProps = {
  variant: "vertical" | "horizontal";
  currentStep: Step;
  stepStates: Record<Step, WizardStepUiState>;
  busy: boolean;
  onStepSelect: (step: Step) => void;
  className?: string;
};

function StepConnector({
  filled,
  orientation,
}: {
  filled: boolean;
  orientation: "horizontal" | "vertical";
}) {
  return (
    <div
      className={cn(
        "rounded-full transition-colors duration-300",
        orientation === "horizontal"
          ? "h-0.5 min-w-[4px] flex-1"
          : "mx-auto my-1 w-0.5 min-h-[28px] flex-1",
        filled
          ? orientation === "horizontal"
            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
            : "bg-gradient-to-b from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500"
          : "bg-zinc-200 dark:bg-zinc-800",
      )}
      aria-hidden
    />
  );
}

type StepChromeProps = {
  meta: (typeof WIZARD_STEPS)[number];
  isActive: boolean;
  state: WizardStepUiState;
  busy: boolean;
  onSelect: () => void;
  layout: "vertical" | "horizontal";
  iconOnly?: boolean;
};

function StepChrome({
  meta,
  isActive,
  state,
  busy,
  onSelect,
  layout,
  iconOnly = false,
}: StepChromeProps) {
  const Icon = STEP_ICONS[meta.id];
  const complete = state.complete;
  const disabled = busy || !state.accessible;
  const tooltipReason = stepTooltipReason(state, busy);

  const baseIconRing = cn(
    "relative flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
    layout === "vertical" ? "size-11" : "size-9",
    isActive &&
    "shadow-md ring-2 ring-zinc-900/15 ring-offset-2 ring-offset-background dark:ring-zinc-100/25",
    complete &&
    !isActive &&
    "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
    !complete &&
    !isActive &&
    "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
    isActive && !complete && "border-primary bg-primary text-primary-foreground",
    disabled && !isActive && "opacity-[0.42]",
  );

  const labelClass = cn(
    "truncate font-medium transition-colors",
    layout === "vertical"
      ? "text-left text-sm leading-snug"
      : "max-w-full text-center text-[11px] leading-tight",
    isActive && "font-semibold text-zinc-900 dark:text-zinc-100",
    !isActive && "text-zinc-600 dark:text-zinc-400",
  );

  const iconMark =
    complete && !isActive ? (
      <Check
        className={layout === "vertical" ? "size-5" : "size-4"}
        aria-hidden
      />
    ) : (
      <Icon className={layout === "vertical" ? "size-5" : "size-4"} />
    );

  const buttonInner =
    layout === "horizontal" && iconOnly ? (
      <div className={baseIconRing}>{iconMark}</div>
    ) : layout === "horizontal" ? (
      <div className="flex w-full min-w-0 flex-col items-center gap-1">
        <div className={baseIconRing}>{iconMark}</div>
        <span className={labelClass}>{meta.shortLabel}</span>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-2">
        <div className={cn(baseIconRing, "mx-auto")}>{iconMark}</div>
        <span className={cn(labelClass, "block text-center")}>{meta.label}</span>
      </div>
    );

  const control = (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      title={tooltipReason}
      aria-current={isActive ? "step" : undefined}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled || isActive) return;
        onSelect();
      }}
      className={cn(
        "h-auto min-w-0 flex-col rounded-2xl border border-transparent px-3 py-2.5 hover:border-zinc-200 hover:bg-zinc-50 disabled:hover:border-transparent disabled:hover:bg-transparent dark:hover:border-zinc-800 dark:hover:bg-zinc-900/80",
        layout === "horizontal" &&
          (iconOnly
            ? "shrink-0 rounded-full p-0 hover:bg-transparent dark:hover:bg-transparent"
            : "w-full min-w-0 px-1.5 py-1.5 sm:px-2"),
        layout === "vertical" && "w-full",
        disabled && !isActive && "cursor-not-allowed",
      )}
    >
      {buttonInner}
    </Button>
  );

  if (!tooltipReason) return control;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            layout === "horizontal" && iconOnly
              ? "shrink-0"
              : layout === "horizontal"
                ? "min-w-0 w-full"
                : "w-full",
            "inline-flex",
          )}
          title={tooltipReason}
        >
          {control}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={layout === "vertical" ? "right" : "bottom"}
        sideOffset={6}
      >
        {tooltipReason}
      </TooltipContent>
    </Tooltip>
  );
}

export function PipelineStepper({
  variant,
  currentStep,
  stepStates,
  busy,
  onStepSelect,
  className,
}: PipelineStepperProps) {
  if (variant === "horizontal") {
    return (
      <nav aria-label="Pipeline steps" className={cn("w-full", className)}>
        <div className="flex w-full items-start px-0.5 pt-1 pb-2">
          {WIZARD_STEPS.map((meta, idx) => {
            const prev = WIZARD_STEPS[idx - 1];
            const isLast = idx === WIZARD_STEPS.length - 1;
            return (
              <Fragment key={meta.id}>
                <div className="flex min-w-0 flex-1 flex-col items-center">
                  <div className="flex h-9 w-full items-center">
                    {idx > 0 ? (
                      <StepConnector
                        orientation="horizontal"
                        filled={Boolean(prev && stepStates[prev.id].complete)}
                      />
                    ) : (
                      <div className="min-w-0 flex-1" aria-hidden />
                    )}
                    <StepChrome
                      meta={meta}
                      layout="horizontal"
                      iconOnly
                      isActive={currentStep === meta.id}
                      state={stepStates[meta.id]}
                      busy={busy}
                      onSelect={() => onStepSelect(meta.id)}
                    />
                    {!isLast ? (
                      <StepConnector
                        orientation="horizontal"
                        filled={stepStates[meta.id].complete}
                      />
                    ) : (
                      <div className="min-w-0 flex-1" aria-hidden />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 max-w-full truncate px-0.5 text-center text-[11px] font-medium leading-tight",
                      currentStep === meta.id
                        ? "font-semibold text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-400",
                      !stepStates[meta.id].accessible && "opacity-[0.42]",
                    )}
                  >
                    {meta.shortLabel}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Pipeline steps" className={cn(className)}>
      <Card className="border-zinc-200/80 bg-white/95 p-3 shadow-md shadow-zinc-200/30 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95 dark:shadow-black/40">
        <div className="flex flex-col items-stretch px-2 py-1">
          {WIZARD_STEPS.map((meta, idx) => {
            const segmentDone = stepStates[meta.id].complete;
            const isLast = idx === WIZARD_STEPS.length - 1;
            return (
              <div key={meta.id} className="flex flex-col items-center">
                <StepChrome
                  meta={meta}
                  layout="vertical"
                  isActive={currentStep === meta.id}
                  state={stepStates[meta.id]}
                  busy={busy}
                  onSelect={() => onStepSelect(meta.id)}
                />
                {!isLast ? (
                  <StepConnector orientation="vertical" filled={segmentDone} />
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </nav>
  );
}
