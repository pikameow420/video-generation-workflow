/** Client may send HTTPS or an app-relative path; return an absolute fetch URL. */
export function resolveSubtitleVideoUrl(
  videoUrl: string,
  requestUrl: string,
): string {
  const trimmed = videoUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return new URL(trimmed, requestUrl).toString();
  }
  throw new Error("videoUrl must be an https URL or app-relative path");
}
