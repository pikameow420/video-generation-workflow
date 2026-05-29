import type { User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { countLocalUserVideoGenerations } from "@/lib/auth/prediction-ownership";
import {
  FREE_VIDEO_LIMIT,
  FREE_VIDEO_LIMIT_REACHED,
  isVideoQuotaExempt,
} from "@/lib/auth/video-quota-policy";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";

export class VideoQuotaExceededError extends Error {
  readonly code = FREE_VIDEO_LIMIT_REACHED;

  constructor() {
    super(
      "You have used your free 15-second video export. Contact the team if you need more.",
    );
    this.name = "VideoQuotaExceededError";
  }
}

export async function countUserVideoGenerations(userId: string): Promise<number> {
  if (!isSupabasePersistenceEnabled()) {
    return countLocalUserVideoGenerations(userId);
  }

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("prediction_ownership")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to count video generations: ${error.message}`);
  }

  return count ?? 0;
}

export type VideoQuotaStatus = {
  exempt: boolean;
  used: number;
  limit: number | null;
  canStart: boolean;
};

export async function getVideoQuotaStatus(user: User): Promise<VideoQuotaStatus> {
  const exempt = isVideoQuotaExempt(user.email);
  const used = await countUserVideoGenerations(user.id);

  if (exempt) {
    return { exempt: true, used, limit: null, canStart: true };
  }

  const limit = FREE_VIDEO_LIMIT;
  return {
    exempt: false,
    used,
    limit,
    canStart: used < limit,
  };
}

export async function assertCanStartVideo(user: User): Promise<void> {
  const status = await getVideoQuotaStatus(user);
  if (!status.canStart) {
    throw new VideoQuotaExceededError();
  }
}
