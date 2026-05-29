import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Point the local fallback at a temp dir before any store call resolves env defaults.
const tmpRoot = mkdtempSync(path.join(tmpdir(), "character-profiles-test-"));
process.env.CHARACTER_PROFILE_INDEX_PATH = path.join(
  tmpRoot,
  "character-profiles.json",
);
process.env.LOCAL_CHARACTER_ASSET_DIR = path.join(tmpRoot, "character-assets");
process.env.LOCAL_CHARACTER_ASSET_BASE_PATH = "/uploads/character-assets";
process.env.REFERENCE_IMAGE_INDEX_PATH = path.join(
  tmpRoot,
  "reference-images.json",
);

vi.mock("@/lib/persistence/backend", () => ({
  isSupabasePersistenceEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CharacterProfileNotFoundError,
  createCharacterProfile,
  deleteCharacterProfile,
  getCharacterProfile,
  listCharacterProfiles,
  saveCharacterProfileSheet,
  saveProfileSheetImage,
  updateCharacterProfile,
} from "@/lib/character-profiles/store";

const persistenceEnabledMock = isSupabasePersistenceEnabled as ReturnType<
  typeof vi.fn
>;
const createAdminClientMock = createAdminClient as ReturnType<typeof vi.fn>;

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("character profile store — local JSON fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceEnabledMock.mockReturnValue(false);
  });

  it("creates a profile with a voice sample and lists it back", async () => {
    const created = await createCharacterProfile({
      name: "Bolt the Mascot",
      artDirection: "flat vector mascot",
      referenceImageIds: [],
      voiceSample: {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "audio/mpeg",
        originalName: "bolt-voice.mp3",
      },
    });

    expect(created.name).toBe("Bolt the Mascot");
    expect(created.artDirection).toBe("flat vector mascot");
    expect(created.voiceSample?.mimeType).toBe("audio/mpeg");
    expect(created.voiceSample?.url).toMatch(/^\/uploads\/character-assets\//);
    expect(created.sheetUrl).toBeNull();
    expect(created.muapiCharacterSheetUrl).toBeNull();
    expect(created.muapiCharacterRequestId).toBeNull();

    const listed = await listCharacterProfiles();
    expect(listed.map((item) => item.id)).toContain(created.id);

    const fetched = await getCharacterProfile(created.id);
    expect(fetched.name).toBe("Bolt the Mascot");
  });

  it("saves a frame-sequence-sheet onto the profile and exposes its URL", async () => {
    const created = await createCharacterProfile({
      name: "Sheet Holder",
      artDirection: "",
      referenceImageIds: [],
      voiceSample: null,
    });
    expect(created.sheetUrl).toBeNull();

    const updated = await saveProfileSheetImage(created.id, {
      bytes: new Uint8Array([9, 9, 9]),
      mimeType: "image/png",
    });
    expect(updated.sheetUrl).toMatch(/^\/uploads\/character-assets\/sheet-/);

    const indexRaw = await readFile(
      process.env.CHARACTER_PROFILE_INDEX_PATH as string,
      "utf8",
    );
    expect(indexRaw).toContain(created.id);
  });

  it("updates name, art direction, and refs, and can replace or remove the voice", async () => {
    const created = await createCharacterProfile({
      name: "Before",
      artDirection: "old direction",
      referenceImageIds: [],
      voiceSample: {
        bytes: new Uint8Array([1]),
        mimeType: "audio/mpeg",
        originalName: "old-voice.mp3",
      },
    });

    const renamed = await updateCharacterProfile(created.id, {
      name: "After",
      artDirection: "new direction",
      referenceImageIds: [],
    });
    expect(renamed.name).toBe("After");
    expect(renamed.artDirection).toBe("new direction");
    expect(renamed.voiceSample?.originalName).toBe("old-voice.mp3");

    const replacedVoice = await updateCharacterProfile(created.id, {
      name: "After",
      artDirection: "new direction",
      referenceImageIds: [],
      voiceSample: {
        bytes: new Uint8Array([2, 2]),
        mimeType: "audio/wav",
        originalName: "new-voice.wav",
      },
    });
    expect(replacedVoice.voiceSample?.originalName).toBe("new-voice.wav");
    expect(replacedVoice.voiceSample?.mimeType).toBe("audio/wav");

    const clearedVoice = await updateCharacterProfile(created.id, {
      name: "After",
      artDirection: "new direction",
      referenceImageIds: [],
      removeVoiceSample: true,
    });
    expect(clearedVoice.voiceSample).toBeNull();

    await expect(
      updateCharacterProfile("00000000-0000-4000-8000-000000000000", {
        name: "Ghost",
        artDirection: "",
        referenceImageIds: [],
      }),
    ).rejects.toBeInstanceOf(CharacterProfileNotFoundError);
  });

  it("saves a character sheet and clears it when reference ids change", async () => {
    const created = await createCharacterProfile({
      name: "Sheet Char",
      artDirection: "",
      referenceImageIds: ["ref-a"],
      voiceSample: null,
    });

    const withSheet = await saveCharacterProfileSheet(created.id, {
      requestId: null,
      bytes: new Uint8Array([4, 5, 6]),
      mimeType: "image/png",
    });
    expect(withSheet.muapiCharacterRequestId).toBeNull();
    expect(withSheet.muapiCharacterSheetUrl).toMatch(
      /^\/uploads\/character-assets\/muapi-char-sheet-/,
    );

    const cleared = await updateCharacterProfile(created.id, {
      name: "Sheet Char",
      artDirection: "",
      referenceImageIds: ["ref-b"],
    });
    expect(cleared.muapiCharacterRequestId).toBeNull();
    expect(cleared.muapiCharacterSheetUrl).toBeNull();
  });

  it("deletes a profile and then refuses to return it", async () => {
    const created = await createCharacterProfile({
      name: "Disposable",
      artDirection: "",
      referenceImageIds: [],
      voiceSample: null,
    });

    await deleteCharacterProfile(created.id);
    await expect(getCharacterProfile(created.id)).rejects.toBeInstanceOf(
      CharacterProfileNotFoundError,
    );
    await expect(deleteCharacterProfile(created.id)).rejects.toBeInstanceOf(
      CharacterProfileNotFoundError,
    );
  });
});

describe("character profile store — Supabase user scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceEnabledMock.mockReturnValue(true);
  });

  it("rejects calls without a userId when Supabase persistence is enabled", async () => {
    await expect(listCharacterProfiles()).rejects.toThrow(/userId required/);
    await expect(
      createCharacterProfile({
        name: "No User",
        artDirection: "",
        referenceImageIds: [],
        voiceSample: null,
      }),
    ).rejects.toThrow(/userId required/);
    await expect(deleteCharacterProfile("some-id")).rejects.toThrow(
      /userId required/,
    );
    await expect(
      updateCharacterProfile("some-id", {
        name: "No User",
        artDirection: "",
        referenceImageIds: [],
      }),
    ).rejects.toThrow(/userId required/);
  });

  it("scopes updates to the owner and 404s on another user's profile", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    createAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    });

    await expect(
      updateCharacterProfile(
        "profile-owned-by-a",
        { name: "Hijack", artDirection: "", referenceImageIds: [] },
        "user-b-uuid",
      ),
    ).rejects.toBeInstanceOf(CharacterProfileNotFoundError);
    expect(eqId).toHaveBeenCalledWith("id", "profile-owned-by-a");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-b-uuid");
  });

  it("filters list queries by the requesting user's id", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    createAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    });

    const items = await listCharacterProfiles("user-a-uuid");
    expect(items).toEqual([]);
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("user_id", "user-a-uuid");
  });

  it("scopes deletes to the owner and 404s on another user's profile", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqUser = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    createAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    });

    await expect(
      deleteCharacterProfile("profile-owned-by-a", "user-b-uuid"),
    ).rejects.toBeInstanceOf(CharacterProfileNotFoundError);
    expect(eqId).toHaveBeenCalledWith("id", "profile-owned-by-a");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-b-uuid");
  });

  it("inserts new profiles with the owning user's id", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert }),
    });

    const created = await createCharacterProfile(
      {
        name: "Scoped",
        artDirection: "soft 3D",
        referenceImageIds: [],
        voiceSample: null,
      },
      "user-a-uuid",
    );
    expect(created.name).toBe("Scoped");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-a-uuid", name: "Scoped" }),
    );
  });
});
