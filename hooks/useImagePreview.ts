"use client";

import { useCallback, useState } from "react";

export type ImagePreview = {
  src: string;
  alt?: string;
  title?: string;
};

export function useImagePreview() {
  const [preview, setPreview] = useState<ImagePreview | null>(null);

  const open = useCallback((next: ImagePreview) => {
    setPreview(next);
  }, []);

  const close = useCallback(() => {
    setPreview(null);
  }, []);

  return {
    preview,
    isOpen: preview !== null,
    open,
    close,
  };
}

export type UseImagePreviewReturn = ReturnType<typeof useImagePreview>;
