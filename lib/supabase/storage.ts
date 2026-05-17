import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadStorageObject(
  client: SupabaseClient,
  bucket: string,
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await client.storage.from(bucket).upload(objectPath, bytes, {
    upsert: true,
    contentType,
  });
  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
}

export async function createStorageSignedUrl(
  client: SupabaseClient,
  bucket: string,
  objectPath: string,
  expiresSec: number,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresSec);
  if (error || !data?.signedUrl) {
    throw new Error(
      `Supabase Storage signed URL failed: ${error?.message ?? "missing URL"}`,
    );
  }
  return data.signedUrl;
}

export async function removeStorageObject(
  client: SupabaseClient,
  bucket: string,
  objectPath: string,
): Promise<void> {
  const { error } = await client.storage.from(bucket).remove([objectPath]);
  if (error) {
    throw new Error(`Supabase Storage remove failed: ${error.message}`);
  }
}
