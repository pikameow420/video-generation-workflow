import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";

type VideoProvider = "atlas" | "muapi";

type LocalPredictionRecord = {
  userId: string;
  provider: VideoProvider;
};

const localPredictions = new Map<string, LocalPredictionRecord>();

export function countLocalUserVideoGenerations(userId: string): number {
  let count = 0;
  for (const record of localPredictions.values()) {
    if (record.userId === userId) count += 1;
  }
  return count;
}

export async function trackPrediction(
  predictionId: string,
  userId: string,
  provider: VideoProvider,
): Promise<void> {
  localPredictions.set(predictionId, { userId, provider });

  if (!isSupabasePersistenceEnabled()) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("prediction_ownership").insert({
    prediction_id: predictionId,
    user_id: userId,
    provider,
  });

  if (error) {
    throw new Error(`Failed to track prediction ownership: ${error.message}`);
  }
}

export async function verifyPredictionOwnership(
  predictionId: string,
  userId: string,
): Promise<boolean> {
  if (!isSupabasePersistenceEnabled()) {
    const record = localPredictions.get(predictionId);
    return record?.userId === userId;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("prediction_ownership")
    .select("user_id")
    .eq("prediction_id", predictionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify prediction ownership: ${error.message}`);
  }

  return data?.user_id === userId;
}
