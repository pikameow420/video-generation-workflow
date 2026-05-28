import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listReferenceImages,
  getReferenceImagesByIds,
  prepareMuapiAnchorUrls,
  generateMuapiCharacterSheet,
  getCharacterProfileSheetContext,
  saveMuapiCharacterSheet,
} = vi.hoisted(() => ({
  listReferenceImages: vi.fn(() => {
    throw new Error("listReferenceImages should not run during sheet generation");
  }),
  getReferenceImagesByIds: vi.fn(() => {
    throw new Error(
      "getReferenceImagesByIds should not run during Supabase sheet generation",
    );
  }),
  prepareMuapiAnchorUrls: vi.fn(async () => ["https://muapi.example/anchor"]),
  generateMuapiCharacterSheet: vi.fn(async () => ({
    requestId: "req-1",
    sheetImageUrl: "https://muapi.example/sheet.png",
  })),
  getCharacterProfileSheetContext: vi.fn(async () => ({
    name: "Bolt",
    artDirection: "flat vector",
    storedReferenceImageIds: ["ref-1"],
  })),
  saveMuapiCharacterSheet: vi.fn(async () => ({
    id: "profile-1",
    name: "Bolt",
    artDirection: "flat vector",
    referenceImages: [],
    voiceSample: null,
    sheetUrl: null,
    muapiCharacterRequestId: "req-1",
    muapiCharacterSheetUrl: "https://signed.example/sheet",
    muapiCharacterSheetUpdatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
}));

vi.mock("@/lib/persistence/backend", () => ({
  isSupabasePersistenceEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/uploads/store", () => ({
  listReferenceImages,
  getReferenceImagesByIds,
  downloadReferenceImagesByIds: vi.fn(),
}));

vi.mock("@/lib/muapi/character-sheet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/muapi/character-sheet")>();
  return {
    ...actual,
    prepareMuapiAnchorUrls,
    generateMuapiCharacterSheet,
  };
});

vi.mock("@/lib/character-profiles/store", () => ({
  getCharacterProfileSheetContext,
  saveMuapiCharacterSheet,
  CharacterProfileNotFoundError: class CharacterProfileNotFoundError extends Error {
    readonly id: string;
    constructor(id: string) {
      super(`Character profile not found: ${id}`);
      this.id = id;
    }
  },
}));

import { generateMuapiCharacterSheetForProfile } from "@/lib/character-profiles/generate-muapi-character-sheet";

describe("generateMuapiCharacterSheetForProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses prepareMuapiAnchorUrls without listing or signing the full library", async () => {
    const result = await generateMuapiCharacterSheetForProfile(
      "profile-1",
      "user-1",
      {
        referenceImageIds: ["ref-1"],
        requestUrl: "http://localhost:3000/api/test",
      },
    );

    expect(prepareMuapiAnchorUrls).toHaveBeenCalledWith(
      ["ref-1"],
      "user-1",
      "http://localhost:3000/api/test",
    );
    expect(listReferenceImages).not.toHaveBeenCalled();
    expect(getReferenceImagesByIds).not.toHaveBeenCalled();
    expect(saveMuapiCharacterSheet).toHaveBeenCalled();
    expect(result.id).toBe("profile-1");
  });
});
