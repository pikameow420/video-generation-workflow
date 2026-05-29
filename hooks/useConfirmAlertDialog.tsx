"use client";

import { useCallback, useState } from "react";

import { ConfirmAlertDialog } from "@/components/ui/confirm-alert-dialog";

export type ConfirmAlertOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmAlertOptions & {
  resolve: (confirmed: boolean) => void;
};

export function useConfirmAlertDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmAlertOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      if (current) current.resolve(confirmed);
      return null;
    });
  }, []);

  const dialog = pending ? (
    <ConfirmAlertDialog
      open
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      destructive={pending.destructive}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, dialog };
}
