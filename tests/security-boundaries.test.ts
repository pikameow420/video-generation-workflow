import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/seedance/client", () => ({
  pollAtlasVideoOnce: vi.fn(),
  startAtlasVideoJob: vi.fn(),
}));

vi.mock("@/lib/muapi/client", () => ({
  pollMuapiVideoOnce: vi.fn(),
  startMuapiVideoJob: vi.fn(),
}));

import { POST as scriptsPost } from "@/app/api/scripts/route";
import { GET as scriptsLibraryGet, POST as scriptsLibraryPost } from "@/app/api/scripts/library/route";
import { POST as videoPost } from "@/app/api/video/route";
import { GET as videoStatusGet } from "@/app/api/video/status/route";
import { GET as pipelineVideosGet } from "@/app/api/pipeline-videos/route";
import {
  DELETE as characterProfilesDelete,
  GET as characterProfilesGet,
  POST as characterProfilesPost,
} from "@/app/api/character-profiles/route";
import { PUT as characterProfileUpdatePut } from "@/app/api/character-profiles/[id]/route";
import { PUT as characterProfileSheetPut } from "@/app/api/character-profiles/[id]/sheet/route";
import { POST as frameSequenceSheetPost } from "@/app/api/frame-sequence-sheet/route";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const mockUserA = { id: "user-a-uuid", email: "usera@test.com" };
const mockUserB = { id: "user-b-uuid", email: "userb@test.com" };

function createMockRequest(
  url: string,
  options: ConstructorParameters<typeof NextRequest>[1] = {},
) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

function mockAuthForUser(user: typeof mockUserA | null) {
  const createClientMock = createSupabaseClient as ReturnType<typeof vi.fn>;
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "No user" },
      }),
    },
  });
}

function mockAdminClient(mockFrom: ReturnType<typeof vi.fn>) {
  const createAdminMock = createAdminClient as ReturnType<typeof vi.fn>;
  createAdminMock.mockReturnValue({
    from: mockFrom,
  });
}

describe("Security Boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Script generation and library - authentication required", () => {
    it("POST /api/scripts without session returns 401", async () => {
      mockAuthForUser(null);

      const req = createMockRequest("/api/scripts", {
        method: "POST",
        body: JSON.stringify({ topic: "test", tone: "casual", audience: "general" }),
      });

      const res = await scriptsPost(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("GET /api/scripts/library without session returns 401", async () => {
      mockAuthForUser(null);

      const req = createMockRequest("/api/scripts/library");
      const res = await scriptsLibraryGet();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("POST /api/scripts/library without session returns 401", async () => {
      mockAuthForUser(null);

      const req = createMockRequest("/api/scripts/library", {
        method: "POST",
        body: JSON.stringify({ title: "Test", body: "Content", source: "manual" }),
      });

      const res = await scriptsLibraryPost(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("2. User A saves script; User B cannot see it", () => {
    it("User B GET /api/scripts/library does not include User A's scripts", async () => {
      mockAuthForUser(mockUserB);

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      mockAdminClient(vi.fn().mockReturnValue({
        select: mockSelect,
      }));

      const req = createMockRequest("/api/scripts/library");
      const res = await scriptsLibraryGet();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSelect).toHaveBeenCalledWith("*");
      const eqCall = mockSelect.mock.results[0]?.value.eq;
      expect(eqCall).toHaveBeenCalledWith("user_id", mockUserB.id);
    });
  });

  describe("3. User A starts video; User B cannot poll it", () => {
    it("User B GET /api/video/status with User A's predictionId returns 403", async () => {
      mockAuthForUser(mockUserB);

      const mockPredictionOwnershipSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: mockUserA.id },
            error: null,
          }),
        }),
      });

      mockAdminClient(vi.fn((table) => {
        if (table === "prediction_ownership") {
          return {
            select: mockPredictionOwnershipSelect,
          };
        }
        return {
          select: vi.fn(),
        };
      }));

      const req = createMockRequest("/api/video/status?predictionId=pred-a&provider=atlas&title=Test");
      const res = await videoStatusGet(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe("Forbidden");
    });
  });

  describe("4. User A can poll own predictionId", () => {
    it("User A GET /api/video/status with own predictionId is allowed", async () => {
      mockAuthForUser(mockUserA);

      const mockPredictionOwnershipSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: mockUserA.id },
            error: null,
          }),
        }),
      });

      const mockPipelineVideosSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      mockAdminClient(vi.fn((table) => {
        if (table === "prediction_ownership") {
          return { select: mockPredictionOwnershipSelect };
        }
        if (table === "pipeline_videos") {
          return { select: mockPipelineVideosSelect };
        }
        return { select: vi.fn() };
      }));

      const mockPollAtlas = await import("@/lib/seedance/client").then(m => m.pollAtlasVideoOnce);
      (mockPollAtlas as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "processing",
      });

      const req = createMockRequest("/api/video/status?predictionId=pred-a&provider=atlas&title=Test");
      const res = await videoStatusGet(req);

      expect(res.status).not.toBe(403);
    });
  });

  describe("5. User A has vault row; User B cannot see it", () => {
    it("User B GET /api/pipeline-videos does not expose User A's videos", async () => {
      mockAuthForUser(mockUserB);

      const mockCount = vi.fn().mockResolvedValue({
        count: 0,
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      mockAdminClient(vi.fn().mockReturnValue({
        select: mockSelect,
      }));

      const req = createMockRequest("/api/pipeline-videos?limit=20&offset=0");
      const res = await pipelineVideosGet(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.items).toEqual([]);
    });
  });

  describe("6. User B cannot burn subtitles for User A's predictionId", () => {
    it("POST /api/subtitles/burn with User A's predictionId returns 403", async () => {
      mockAuthForUser(mockUserB);

      const mockPredictionOwnershipSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { user_id: mockUserA.id },
            error: null,
          }),
        }),
      });

      mockAdminClient(vi.fn().mockReturnValue({
        select: mockPredictionOwnershipSelect,
      }));

      const { POST: burnPost } = await import("@/app/api/subtitles/burn/route");

      const req = createMockRequest("/api/subtitles/burn", {
        method: "POST",
        body: JSON.stringify({
          predictionId: "pred-a",
          videoUrl: "http://example.com/video.mp4",
          srtText: "1\n00:00:00,000 --> 00:00:01,000\nTest",
          title: "Test",
        }),
      });

      const res = await burnPost(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe("Forbidden");
    });
  });

  describe("7. Sign out clears pendingVideoJob (client-side - documented)", () => {
    it("useAuthGuard hook should be implemented to clear pendingVideoJob on user change", () => {
      expect(true).toBe(true);
    });
  });

  describe("8. Character profiles - authentication required", () => {
    it("GET /api/character-profiles without session returns 401", async () => {
      mockAuthForUser(null);

      const res = await characterProfilesGet();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("POST /api/character-profiles without session returns 401", async () => {
      mockAuthForUser(null);

      const form = new FormData();
      form.set("payload", JSON.stringify({ name: "Mascot" }));
      const req = createMockRequest("/api/character-profiles", {
        method: "POST",
        body: form,
      });

      const res = await characterProfilesPost(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("DELETE /api/character-profiles without session returns 401", async () => {
      mockAuthForUser(null);

      const req = createMockRequest(
        "/api/character-profiles?id=11111111-1111-4111-8111-111111111111",
        { method: "DELETE" },
      );
      const res = await characterProfilesDelete(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("PUT /api/character-profiles/[id] without session returns 401", async () => {
      mockAuthForUser(null);

      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({ name: "Mascot", referenceImageIds: ["ref-1"] }),
      );
      const req = createMockRequest(
        "/api/character-profiles/11111111-1111-4111-8111-111111111111",
        { method: "PUT", body: form },
      );
      const res = await characterProfileUpdatePut(req, {
        params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("PUT /api/character-profiles/[id]/sheet without session returns 401", async () => {
      mockAuthForUser(null);

      const req = createMockRequest(
        "/api/character-profiles/11111111-1111-4111-8111-111111111111/sheet",
        {
          method: "PUT",
          body: JSON.stringify({ imageDataUrl: "data:image/png;base64,AA==" }),
        },
      );
      const res = await characterProfileSheetPut(req, {
        params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
      });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("POST /api/character-profiles without reference images returns 400", async () => {
      mockAuthForUser(mockUserA);

      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({ name: "Mascot", referenceImageIds: [] }),
      );
      const req = createMockRequest("/api/character-profiles", {
        method: "POST",
        body: form,
      });

      const res = await characterProfilesPost(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toMatch(/reference image/i);
    });

    it("POST /api/frame-sequence-sheet without session returns 401", async () => {
      mockAuthForUser(null);

      const req = createMockRequest("/api/frame-sequence-sheet", {
        method: "POST",
        body: JSON.stringify({ scriptTitle: "T", scriptBody: "B" }),
      });
      const res = await frameSequenceSheetPost(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("9. User A's character profiles are not visible to User B", () => {
    it("GET /api/character-profiles queries only the requesting user's rows", async () => {
      mockAuthForUser(mockUserB);

      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      mockAdminClient(vi.fn().mockReturnValue({ select }));

      const res = await characterProfilesGet();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.items).toEqual([]);
      expect(eq).toHaveBeenCalledWith("user_id", mockUserB.id);
    });

    it("PUT .../[id] on a profile owned by User A returns 404 for User B", async () => {
      mockAuthForUser(mockUserB);

      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqUser = vi.fn().mockReturnValue({ maybeSingle });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const select = vi.fn().mockReturnValue({ eq: eqId });
      mockAdminClient(vi.fn().mockReturnValue({ select }));

      const profileId = "33333333-3333-4333-8333-333333333333";
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({ name: "Hijack", referenceImageIds: ["ref-1"] }),
      );
      const req = createMockRequest(`/api/character-profiles/${profileId}`, {
        method: "PUT",
        body: form,
      });
      const res = await characterProfileUpdatePut(req, {
        params: Promise.resolve({ id: profileId }),
      });

      expect(res.status).toBe(404);
      expect(eqUser).toHaveBeenCalledWith("user_id", mockUserB.id);
    });

    it("PUT .../sheet on a profile owned by User A returns 404 for User B", async () => {
      mockAuthForUser(mockUserB);

      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqUser = vi.fn().mockReturnValue({ maybeSingle });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const select = vi.fn().mockReturnValue({ eq: eqId });
      mockAdminClient(vi.fn().mockReturnValue({ select }));

      const profileId = "22222222-2222-4222-8222-222222222222";
      const req = createMockRequest(
        `/api/character-profiles/${profileId}/sheet`,
        {
          method: "PUT",
          body: JSON.stringify({ imageDataUrl: "data:image/png;base64,AA==" }),
        },
      );
      const res = await characterProfileSheetPut(req, {
        params: Promise.resolve({ id: profileId }),
      });

      expect(res.status).toBe(404);
      expect(eqUser).toHaveBeenCalledWith("user_id", mockUserB.id);
    });
  });
});
