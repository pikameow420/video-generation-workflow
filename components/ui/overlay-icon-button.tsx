"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const overlayBaseClass =
  "z-10 size-7 shrink-0 rounded-full border-0 bg-black/60 p-0 text-white shadow-sm hover:bg-black/80 hover:text-white dark:hover:bg-black/80";

type OverlayIconButtonProps = ComponentProps<typeof Button> & {
  position?: "left" | "right";
};

/** Small circular icon control overlaid on thumbnails/cards. */
export function OverlayIconButton({
  className,
  position = "right",
  size = "icon-xs",
  variant = "ghost",
  ...props
}: OverlayIconButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        overlayBaseClass,
        position === "left" ? "absolute left-1 top-1" : "absolute right-1 top-1",
        className,
      )}
      {...props}
    />
  );
}
