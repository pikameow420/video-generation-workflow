import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/config";

export function createClient() {
  const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();
  return createBrowserClient(supabaseUrl, supabaseKey);
}
