import { getEnv } from "@/lib/env";

/** True when server should use Postgres + Storage instead of JSON / local disk / Vercel Blob. */
export function isSupabasePersistenceEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SECRET_KEY?.trim());
}
