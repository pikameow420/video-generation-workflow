export const FREE_VIDEO_LIMIT = 1;
export const FREE_VIDEO_LIMIT_REACHED = "FREE_VIDEO_LIMIT_REACHED";

export function isVideoQuotaExempt(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().startsWith("advit");
}
