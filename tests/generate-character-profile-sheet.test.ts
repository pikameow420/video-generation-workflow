import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listReferenceImages,
  getReferenceImagesByIds,
  generateCharacterProfileSheetWithOpenAI,
  getCharacterProfileSheetContext,
  saveCharacterProfileSheet,
} = vi.hoisted(() => ({
  listReferenceImages: vi.fn(() => {
    throw new Error("listReferenceImages should not run during sheet generation");
  }),
  getReferenceImagesByIds: vi.fn(async () => [
    {
      id: "ref-1",
      url: "https://signed.example/anchor.png",
      mimeType: "image/png",
      bytes: 100,
      originalName: "anchor.png",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]),
  generateCharacterProfileSheetWithOpenAI: vi.fn(async () => ({
    mimeType: "image/png",
    bytes: new Uint8Array([1, 2, 3]),
  })),
  getCharacterProfileSheetContext: vi.fn(async () => ({
    name: "Bolt",
    artDirection: "flat vector",
    storedReferenceImageIds: ["ref-1"],
  })),
  saveCharacterProfileSheet: vi.fn(async () => ({
    id: "profile-1",
    name: "Bolt",
    artDirection: "flat vector",
    referenceImages: [],
    voiceSample: null,
    sheetUrl: null,
    muapiCharacterRequestId: null,
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
}));

vi.mock("@/lib/openai/images", () => ({
  generateCharacterProfileSheetWithOpenAI,
}));

vi.mock("@/lib/character-profiles/store", () => ({
  getCharacterProfileSheetContext,
  saveCharacterProfileSheet,
  CharacterProfileNotFoundError: class CharacterProfileNotFoundError extends Error {
    readonly id: string;
    constructor(id: string) {
      super(`Character profile not found: ${id}`);
      this.id = id;
    }
  },
}));

import { buildCharacterProfileSheetPrompt } from "@/lib/prompts/character-profile-sheet";
import { generateCharacterProfileSheetForProfile } from "@/lib/character-profiles/generate-character-profile-sheet";

describe("buildCharacterProfileSheetPrompt", () => {
  it("includes character name and art direction", () => {
    const prompt = buildCharacterProfileSheetPrompt({
      characterName: "Bolt",
      artDirection: "flat vector",
    });
    expect(prompt).toContain("Bolt");
    expect(prompt).toContain("flat vector");
  });
});

describe("generateCharacterProfileSheetForProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads anchors by id and calls OpenAI without listing the full library", async () => {
    const result = await generateCharacterProfileSheetForProfile(
      "profile-1",
      "user-1",
      {
        referenceImageIds: ["ref-1"],
        requestUrl: "http://localhost:3000/api/test",
      },
    );

    expect(getReferenceImagesByIds).toHaveBeenCalledWith(["ref-1"], "user-1");
    expect(listReferenceImages).not.toHaveBeenCalled();
    expect(generateCharacterProfileSheetWithOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        requestUrl: "http://localhost:3000/api/test",
        referenceImageUrls: ["https://signed.example/anchor.png"],
        prompt: expect.stringContaining("Bolt"),
      }),
    );
    expect(saveCharacterProfileSheet).toHaveBeenCalledWith(
      "profile-1",
      expect.objectContaining({
        requestId: null,
        mimeType: "image/png",
      }),
      "user-1",
    );
    expect(result.id).toBe("profile-1");
  });
});
