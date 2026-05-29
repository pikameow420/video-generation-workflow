import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";
import { createAdminClient } from "@/lib/supabase/admin";
import { dedupeByTitleBody, savedScriptDedupeKey } from "@/lib/scripts/dedupe";
import { savedScriptSchema } from "@/lib/schemas";

export type SavedScriptSource = "generated" | "manual" | "uploaded";

export type SavedScriptRecord = {
  id: string;
  title: string;
  body: string;
  source: SavedScriptSource;
  createdAt: string;
};

type PutSavedScriptInput = {
  title: string;
  body: string;
  source: SavedScriptSource;
};

async function readIndex(indexPath: string): Promise<SavedScriptRecord[]> {
  try {
    const content = await readFile(indexPath, "utf8");
    try {
      const parsed = JSON.parse(content) as SavedScriptRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Recover from minor JSON corruption (e.g. accidental trailing chars).
      const firstBracket = content.indexOf("[");
      const lastBracket = content.lastIndexOf("]");
      if (firstBracket >= 0 && lastBracket > firstBracket) {
        const extracted = content.slice(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(extracted) as SavedScriptRecord[];
        return Array.isArray(parsed) ? parsed : [];
      }
      throw new Error("saved-scripts index is invalid JSON");
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function appendToIndex(record: SavedScriptRecord): Promise<void> {
  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.SAVED_SCRIPT_INDEX_PATH);
  await mkdir(path.dirname(indexPath), { recursive: true });
  const current = await readIndex(indexPath);
  current.unshift(record);
  await writeFile(indexPath, JSON.stringify(current, null, 2), "utf8");
}

function asIso(ts: unknown): string {
  if (typeof ts === "string") return ts;
  if (ts instanceof Date) return ts.toISOString();
  return new Date(ts as never).toISOString();
}

async function putSavedScriptSupabase(
  input: PutSavedScriptInput,
  userId: string,
): Promise<SavedScriptRecord> {
  const admin = createAdminClient();
  const title = input.title.trim();
  const body = input.body.trim();
  const { data: existing, error: lookupError } = await admin
    .from("saved_scripts")
    .select("*")
    .eq("user_id", userId)
    .eq("title", title)
    .eq("body", body)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`saved_scripts lookup failed: ${lookupError.message}`);
  }
  if (existing) {
    return savedScriptSchema.parse({
      id: existing.id as string,
      title: existing.title as string,
      body: existing.body as string,
      source: existing.source as SavedScriptSource,
      createdAt: asIso(existing.created_at),
    });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const { error } = await admin.from("saved_scripts").insert({
    id,
    title,
    body,
    source: input.source,
    created_at: createdAt,
    user_id: userId,
  });
  if (error) {
    throw new Error(`saved_scripts insert failed: ${error.message}`);
  }

  const record = savedScriptSchema.parse({
    id,
    title,
    body,
    source: input.source,
    createdAt,
  });
  return record;
}

async function listSavedScriptsSupabase(userId: string): Promise<SavedScriptRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("saved_scripts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`saved_scripts list failed: ${error.message}`);
  }
  if (!data?.length) return [];

  const items = data.map((row): SavedScriptRecord =>
    savedScriptSchema.parse({
      id: row.id as string,
      title: row.title as string,
      body: row.body as string,
      source: row.source as SavedScriptSource,
      createdAt: asIso(row.created_at),
    }),
  );
  return dedupeByTitleBody(items);
}

export async function putSavedScript(
  input: PutSavedScriptInput,
  userId?: string,
): Promise<SavedScriptRecord> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return putSavedScriptSupabase(input, userId);
  }

  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.SAVED_SCRIPT_INDEX_PATH);
  const current = await readIndex(indexPath);
  const title = input.title.trim();
  const body = input.body.trim();
  const key = savedScriptDedupeKey(title, body);
  const existing = current.find(
    (item) => savedScriptDedupeKey(item.title, item.body) === key,
  );
  if (existing) return existing;

  const record = savedScriptSchema.parse({
    id: randomUUID(),
    title,
    body,
    source: input.source,
    createdAt: new Date().toISOString(),
  });
  await appendToIndex(record);
  return record;
}

export async function listSavedScripts(userId?: string): Promise<SavedScriptRecord[]> {
  if (isSupabasePersistenceEnabled()) {
    if (!userId) {
      throw new Error("userId required when Supabase persistence is enabled");
    }
    return listSavedScriptsSupabase(userId);
  }

  const env = getEnv();
  const indexPath = path.resolve(process.cwd(), env.SAVED_SCRIPT_INDEX_PATH);
  const records = await readIndex(indexPath);
  return dedupeByTitleBody(
    records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}
