import { beforeAll } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "test-anon-key";
  process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "test-service-role-key";
});
