/** Shared wizard constants and helpers. */

import type { VideoProvider } from "@/lib/schemas";

export const WIZARD_STORAGE_KEY = "video-pipeline-wizard-state-v1";
export const MAX_MANUAL_SCRIPT_FILE_BYTES = 256 * 1024;
export const MAX_REFERENCE_IMAGES = 9;
export const VIDEO_PROVIDER_STORAGE_KEY = "pipeline-video-provider";

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function readStoredVideoProvider(): VideoProvider | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(VIDEO_PROVIDER_STORAGE_KEY);
  return raw === "atlas" || raw === "muapi" ? raw : null;
}

export function normalizeReferenceUrl(url: string): string {
  return url.trim();
}

export function dedupeReferenceUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const raw of urls) {
    const normalized = normalizeReferenceUrl(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
    if (deduped.length >= MAX_REFERENCE_IMAGES) break;
  }
  return deduped;
}
