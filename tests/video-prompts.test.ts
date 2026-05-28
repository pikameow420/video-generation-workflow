import { describe, expect, it } from "vitest";

import { buildMuapiOmniReferencePrompt } from "@/lib/prompts/video";

describe("buildMuapiOmniReferencePrompt", () => {
  it("includes @character lines and named @audio for two characters", () => {
    const prompt = buildMuapiOmniReferencePrompt(
      "Duo",
      "Alice and Bob talk.",
      [
        { kind: "frameSheet" },
        { kind: "characterSheet", name: "Alice", profileId: "a" },
        { kind: "characterSheet", name: "Bob", profileId: "b" },
      ],
      [
        { name: "Alice", profileId: "a" },
        { name: "Bob", profileId: "b" },
      ],
      [
        { name: "Alice", requestId: "req-alice" },
        { name: "Bob", requestId: "req-bob" },
      ],
    );

    expect(prompt).toContain("@image1");
    expect(prompt).toContain('Character "Alice"');
    expect(prompt).toContain('Character "Bob"');
    expect(prompt).toContain("@character:req-alice");
    expect(prompt).toContain("@character:req-bob");
    expect(prompt).toContain("@audio1");
    expect(prompt).toContain("@audio2");
  });
});
