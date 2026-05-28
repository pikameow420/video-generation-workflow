import { describe, expect, it } from "vitest";

import {
  assertRunReadyForFrameSheet,
  assertRunReadyForMuapiVideo,
} from "@/lib/pipeline/run-readiness";
import type { CharacterProfile } from "@/lib/schemas";

function mockProfile(
  overrides: Partial<CharacterProfile> & { id: string; name: string },
): CharacterProfile {
  return {
    id: overrides.id,
    name: overrides.name,
    artDirection: "",
    referenceImages: [],
    voiceSample: overrides.voiceSample ?? null,
    sheetUrl: null,
    muapiCharacterRequestId: overrides.muapiCharacterRequestId ?? "req-1",
    muapiCharacterSheetUrl:
      overrides.muapiCharacterSheetUrl ?? "https://example.com/sheet.png",
    muapiCharacterSheetUpdatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("run readiness", () => {
  it("requires character sheets for frame sheet generation", () => {
    const run = [{ profileId: "a", extraReferenceUrls: [] as string[] }];
    const profiles = [
      mockProfile({
        id: "a",
        name: "Alice",
        muapiCharacterSheetUrl: null,
        muapiCharacterRequestId: null,
      }),
    ];
    const result = assertRunReadyForFrameSheet(run, profiles);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("character sheet");
    }
  });

  it("requires voice samples for video", () => {
    const run = [{ profileId: "a", extraReferenceUrls: [] as string[] }];
    const profiles = [
      mockProfile({
        id: "a",
        name: "Alice",
        voiceSample: null,
      }),
    ];
    const result = assertRunReadyForMuapiVideo(run, profiles);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("voice sample");
    }
  });
});
