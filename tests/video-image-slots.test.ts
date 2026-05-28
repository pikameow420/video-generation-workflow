import { describe, expect, it } from "vitest";

import { buildVideoImagePlan } from "@/lib/pipeline/video-image-slots";
import type { CharacterProfile } from "@/lib/schemas";

function mockProfile(overrides: Partial<CharacterProfile> & { id: string; name: string }): CharacterProfile {
  return {
    id: overrides.id,
    name: overrides.name,
    artDirection: "",
    referenceImages: [],
    voiceSample: overrides.voiceSample ?? {
      url: "https://example.com/voice.mp3",
      mimeType: "audio/mpeg",
      originalName: "v.mp3",
    },
    sheetUrl: null,
    muapiCharacterRequestId: overrides.muapiCharacterRequestId ?? "req-alice",
    muapiCharacterSheetUrl:
      overrides.muapiCharacterSheetUrl ?? "https://example.com/alice-sheet.png",
    muapiCharacterSheetUpdatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildVideoImagePlan", () => {
  it("orders frame sheet first then two character sheets for duo run", () => {
    const alice = mockProfile({ id: "a", name: "Alice" });
    const bob = mockProfile({
      id: "b",
      name: "Bob",
      muapiCharacterRequestId: "req-bob",
      muapiCharacterSheetUrl: "https://example.com/bob-sheet.png",
    });

    const plan = buildVideoImagePlan({
      frameSheetUrl: "https://example.com/frame.png",
      runCharacters: [
        { profileId: "a", extraReferenceUrls: [] },
        { profileId: "b", extraReferenceUrls: [] },
      ],
      profiles: [alice, bob],
    });

    expect(plan.imageUrls).toEqual([
      "https://example.com/frame.png",
      "https://example.com/alice-sheet.png",
      "https://example.com/bob-sheet.png",
    ]);
    expect(plan.imageSlots[0]).toEqual({ kind: "frameSheet" });
    expect(plan.imageSlots[1]).toMatchObject({
      kind: "characterSheet",
      name: "Alice",
    });
    expect(plan.muapiCharacterRequestIds).toHaveLength(2);
    expect(plan.audioSlots).toHaveLength(2);
  });
});
