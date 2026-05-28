import { describe, expect, it } from "vitest";

import { mergeCharacterProfileLists } from "@/lib/character-profiles/merge-profiles";
import type { CharacterProfile } from "@/lib/schemas";

function mockProfile(id: string, updatedAt: string): CharacterProfile {
  return {
    id,
    name: id,
    artDirection: "",
    referenceImages: [],
    voiceSample: null,
    sheetUrl: null,
    muapiCharacterRequestId: null,
    muapiCharacterSheetUrl: null,
    muapiCharacterSheetUpdatedAt: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("mergeCharacterProfileLists", () => {
  it("keeps optimistic local rows missing from server response", () => {
    const server = [mockProfile("server-only", "2026-01-02T00:00:00.000Z")];
    const local = [mockProfile("just-created", "2026-01-03T00:00:00.000Z")];
    const merged = mergeCharacterProfileLists(server, local);
    expect(merged.map((p) => p.id).sort()).toEqual(["just-created", "server-only"]);
  });
});
