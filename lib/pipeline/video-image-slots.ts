import { MAX_REFERENCE_IMAGES } from "@/lib/pipeline/wizard-utils";
import type { RunCharacterSelection } from "@/components/pipeline/types";
import type {
  videoAudioSlotSchema,
  videoImageSlotSchema,
} from "@/lib/schemas";
import type { CharacterProfile } from "@/lib/schemas";
import type { z } from "zod";

export type VideoImageSlot = z.infer<typeof videoImageSlotSchema>;
export type VideoAudioSlot = {
  name: string;
  profileId: string;
};

export type VideoImagePlan = {
  imageUrls: string[];
  imageSlots: VideoImageSlot[];
  audioSlots: VideoAudioSlot[];
  muapiCharacterRequestIds: { name: string; requestId: string }[];
};

function normalizeUrl(url: string): string {
  return url.trim();
}

export function buildVideoImagePlan(input: {
  frameSheetUrl: string;
  runCharacters: RunCharacterSelection[];
  profiles: CharacterProfile[];
}): VideoImagePlan {
  const imageUrls: string[] = [];
  const imageSlots: VideoImageSlot[] = [];
  const seen = new Set<string>();

  const pushUrl = (url: string, slot: VideoImageSlot) => {
    const key = normalizeUrl(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    imageUrls.push(url);
    imageSlots.push(slot);
  };

  pushUrl(input.frameSheetUrl, { kind: "frameSheet" });

  const audioSlots: VideoAudioSlot[] = [];
  const muapiCharacterRequestIds: { name: string; requestId: string }[] = [];

  for (const run of input.runCharacters) {
    const profile = input.profiles.find((p) => p.id === run.profileId);
    if (!profile) continue;

    if (profile.characterSheetUrl) {
      pushUrl(profile.characterSheetUrl, {
        kind: "characterSheet",
        name: profile.name,
        profileId: profile.id,
      });
    }

    if (profile.muapiCharacterRequestId) {
      muapiCharacterRequestIds.push({
        name: profile.name,
        requestId: profile.muapiCharacterRequestId,
      });
    }

    for (const url of run.extraReferenceUrls) {
      pushUrl(url, { kind: "extra" });
    }

    audioSlots.push({ name: profile.name, profileId: profile.id });
  }

  if (imageUrls.length > MAX_REFERENCE_IMAGES) {
    throw new Error(
      `Too many reference images (${imageUrls.length}). Maximum is ${MAX_REFERENCE_IMAGES}.`,
    );
  }

  if (imageUrls.length !== imageSlots.length) {
    throw new Error("Video image plan internal error: URL/slot count mismatch");
  }

  return {
    imageUrls,
    imageSlots,
    audioSlots: audioSlots.slice(0, 3),
    muapiCharacterRequestIds: muapiCharacterRequestIds.slice(0, 3),
  };
}
