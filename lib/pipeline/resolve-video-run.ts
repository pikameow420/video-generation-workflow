import type { RunCharacterSelection } from "@/components/pipeline/types";
import { getCharacterProfile } from "@/lib/character-profiles/store";
import {
  assertRunReadyForFrameSheet,
  assertRunReadyForMuapiVideo,
} from "@/lib/pipeline/run-readiness";
import {
  buildVideoImagePlan,
  type VideoImagePlan,
} from "@/lib/pipeline/video-image-slots";
import type { CharacterProfile, VideoProvider } from "@/lib/schemas";

export function runCharactersFromProfileIds(
  profileIds: string[],
): RunCharacterSelection[] {
  return profileIds.map((profileId) => ({
    profileId,
    extraReferenceUrls: [],
  }));
}

export async function loadRunProfilesInOrder(
  profileIds: string[],
  userId: string,
): Promise<CharacterProfile[]> {
  const profiles: CharacterProfile[] = [];
  for (const id of profileIds) {
    profiles.push(await getCharacterProfile(id, userId));
  }
  return profiles;
}

export async function buildServerVideoPlan(params: {
  frameSheetUrl: string;
  runProfileIds: string[];
  userId: string;
  provider: VideoProvider;
  resolveImageUrl: (raw: string) => Promise<string | undefined>;
}): Promise<VideoImagePlan> {
  const runCharacters = runCharactersFromProfileIds(params.runProfileIds);
  const profiles = await loadRunProfilesInOrder(params.runProfileIds, params.userId);

  const readiness =
    params.provider === "muapi"
      ? assertRunReadyForMuapiVideo(runCharacters, profiles)
      : assertRunReadyForFrameSheet(runCharacters, profiles);
  if (!readiness.ok) {
    throw new Error(readiness.reason);
  }

  const plan = buildVideoImagePlan({
    frameSheetUrl: params.frameSheetUrl,
    runCharacters,
    profiles,
  });

  const resolvedUrls: string[] = [];
  for (const url of plan.imageUrls) {
    const resolved = await params.resolveImageUrl(url);
    if (!resolved) {
      throw new Error("Could not resolve a reference image URL for video generation");
    }
    resolvedUrls.push(resolved);
  }

  if (resolvedUrls.length !== plan.imageSlots.length) {
    throw new Error("Video reference plan is inconsistent after URL resolution");
  }

  return { ...plan, imageUrls: resolvedUrls };
}
