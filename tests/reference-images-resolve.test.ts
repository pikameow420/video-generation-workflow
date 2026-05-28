import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "reference-resolve-test-"));
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
  downloadReferenceImagesByIds,
  getReferenceImagesByIds,
  listReferenceImages,
  putReferenceImage,
} from "@/lib/uploads/store";

const persistenceEnabledMock = isSupabasePersistenceEnabled as ReturnType<
  typeof vi.fn
>;
const createAdminClientMock = createAdminClient as ReturnType<typeof vi.fn>;

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("reference image resolve by ids", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistenceEnabledMock.mockReturnValue(false);
    writeFileSync(process.env.REFERENCE_IMAGE_INDEX_PATH!, "[]", "utf8");
  });

  it("getReferenceImagesByIds returns only requested records", async () => {
    const a = await putReferenceImage({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      originalName: "a.png",
    });
    const b = await putReferenceImage({
      bytes: new Uint8Array([2]),
      mimeType: "image/png",
      originalName: "b.png",
    });
    await putReferenceImage({
      bytes: new Uint8Array([3]),
      mimeType: "image/png",
      originalName: "c.png",
    });

    const resolved = await getReferenceImagesByIds([a.id, b.id]);
    expect(resolved.map((item) => item.id)).toEqual([a.id, b.id]);
    expect(resolved).toHaveLength(2);
  });

  it("listReferenceImages still returns the full library in local mode", async () => {
    await putReferenceImage({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      originalName: "one.png",
    });
    await putReferenceImage({
      bytes: new Uint8Array([2]),
      mimeType: "image/png",
      originalName: "two.png",
    });

    const all = await listReferenceImages();
    expect(all).toHaveLength(2);
  });

  it("signReferenceImagesByIds path signs only selected rows in Supabase mode", async () => {
    persistenceEnabledMock.mockReturnValue(true);

    const createSignedUrl = vi.fn((_path: string, _expires: number) =>
      Promise.resolve({
        data: { signedUrl: "https://signed.example/object" },
        error: null,
      }),
    );

    const admin = {
      from: vi.fn((table: string) => {
        if (table !== "reference_images") {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: "ref-1",
                      storage_path: "a-ref-1.png",
                      mime_type: "image/png",
                      bytes: 10,
                      original_name: "a.png",
                      created_at: "2026-01-01T00:00:00.000Z",
                    },
                    {
                      id: "ref-2",
                      storage_path: "b-ref-2.png",
                      mime_type: "image/png",
                      bytes: 20,
                      original_name: "b.png",
                      created_at: "2026-01-02T00:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              ),
              order: vi.fn(),
            })),
          })),
          insert: vi.fn(),
        };
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl,
        })),
      },
    };

    createAdminClientMock.mockReturnValue(admin);

    const resolved = await getReferenceImagesByIds(["ref-1", "ref-2"], "user-1");
    expect(resolved).toHaveLength(2);
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    expect(resolved[0]?.url).toBe("https://signed.example/object");
  });

  it("downloadReferenceImagesByIds does not create signed URLs in Supabase mode", async () => {
    persistenceEnabledMock.mockReturnValue(true);

    const createSignedUrl = vi.fn();
    const download = vi.fn(() =>
      Promise.resolve({
        data: new Blob([9, 8, 7], { type: "image/png" }),
        error: null,
      }),
    );

    const admin = {
      from: vi.fn((table: string) => {
        if (table !== "reference_images") {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: "ref-1",
                      storage_path: "a-ref-1.png",
                      mime_type: "image/png",
                      bytes: 10,
                      original_name: "a.png",
                      created_at: "2026-01-01T00:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              ),
              order: vi.fn(),
            })),
          })),
        };
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl,
          download,
        })),
      },
    };

    createAdminClientMock.mockReturnValue(admin);

    const downloaded = await downloadReferenceImagesByIds(["ref-1"], "user-1");
    expect(downloaded).toHaveLength(1);
    expect(downloaded[0]?.id).toBe("ref-1");
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(1);
  });
});
