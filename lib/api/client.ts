import { z } from "zod";

type ApiErrorShape = {
  error?: string;
  message?: string;
};

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function resolveErrorMessage(
  parsed: ApiErrorShape | null,
  fallback: string,
): string {
  return parsed?.error || parsed?.message || fallback;
}

function parseWithSchema<T>(
  parsed: unknown,
  schema: z.ZodType<T> | undefined,
  fallbackError: string,
): T {
  if (!schema) {
    return (parsed ?? {}) as T;
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `${fallbackError}: invalid response shape (${validated.error.issues
        .map((issue) => issue.message)
        .join("; ")})`,
    );
  }
  return validated.data;
}

export async function getJson<T>(
  url: string,
  fallbackError: string,
  schema?: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  const parsed = await readJson<T & ApiErrorShape>(res);
  if (!res.ok) {
    throw new Error(resolveErrorMessage(parsed, fallbackError));
  }
  return parseWithSchema(parsed, schema, fallbackError);
}

export async function postJson<T>(
  url: string,
  body: unknown,
  fallbackError: string,
  schema?: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await readJson<T & ApiErrorShape>(res);
  if (!res.ok) {
    throw new Error(resolveErrorMessage(parsed, fallbackError));
  }
  return parseWithSchema(parsed, schema, fallbackError);
}

export async function postForm<T>(
  url: string,
  body: FormData,
  fallbackError: string,
  schema?: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    body,
  });
  const parsed = await readJson<T & ApiErrorShape>(res);
  if (!res.ok) {
    throw new Error(resolveErrorMessage(parsed, fallbackError));
  }
  return parseWithSchema(parsed, schema, fallbackError);
}

export async function deleteJson(
  url: string,
  fallbackError: string,
): Promise<void> {
  const res = await fetch(url, { method: "DELETE" });
  const parsed = await readJson<ApiErrorShape>(res);
  if (!res.ok) {
    throw new Error(resolveErrorMessage(parsed, fallbackError));
  }
}
