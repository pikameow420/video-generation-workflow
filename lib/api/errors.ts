import { ZodError } from "zod";

export function parseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => issue.message).join("; ");
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
