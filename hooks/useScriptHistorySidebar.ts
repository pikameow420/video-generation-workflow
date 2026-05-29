"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  OPEN_SCRIPT_HISTORY_PARAM,
  OPEN_SCRIPT_HISTORY_VALUE,
} from "@/lib/pipeline/script-history-open";

type UseScriptHistorySidebarOptions = {
  savedScriptsLoaded: boolean;
  loadSavedScripts: () => void | Promise<void>;
};

export function useScriptHistorySidebar({
  savedScriptsLoaded,
  loadSavedScripts,
}: UseScriptHistorySidebarOptions) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
    if (!savedScriptsLoaded) void loadSavedScripts();
  }, [loadSavedScripts, savedScriptsLoaded]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [close, isOpen, open]);

  useEffect(() => {
    if (searchParams.get(OPEN_SCRIPT_HISTORY_PARAM) !== OPEN_SCRIPT_HISTORY_VALUE) {
      return;
    }
    open();
    const url = new URL(window.location.href);
    url.searchParams.delete(OPEN_SCRIPT_HISTORY_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [open, searchParams]);

  return { isOpen, setIsOpen, open, close, toggle };
}
