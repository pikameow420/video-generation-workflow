import { ZodError } from "zod";

/** User-facing message from API route catch blocks (Zod + Error + unknown). */
export function parseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => issue.message).join("; ");
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
