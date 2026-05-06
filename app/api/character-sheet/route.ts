import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { characterSheetRequestSchema } from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import { buildCharacterSheetPrompt } from "@/lib/prompts/character-sheet";

// TODO: Let user upload their own image for base character.

export const runtime = "nodejs";

async function atlasImageAsDataUrl(
  prompt: string,
): Promise<{ mimeType: string; dataUrl: string }> {
  const env = getEnv();
  const apiKey = env.ATLASCLOUD_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("ATLASCLOUD_API_KEY is required for image generation");
  }

  const createRes = await fetch(
    `${env.ATLASCLOUD_BASE_URL}/api/v1/model/generateImage`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.ATLASCLOUD_IMAGE_MODEL,
        prompt,
        width: env.ATLASCLOUD_IMAGE_WIDTH,
        height: env.ATLASCLOUD_IMAGE_HEIGHT,
      }),
    },
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Atlas generateImage failed (${createRes.status}): ${text}`);
  }

  const createJson = (await createRes.json()) as {
    id?: string;
    data?: { id?: string };
  };
  const predictionId = createJson.data?.id ?? createJson.id;
  if (!predictionId) {
    throw new Error("Atlas generateImage: missing prediction id");
  }

  const deadline = Date.now() + env.ATLASCLOUD_POLL_MAX_MS;
  let imageUrl: string | undefined;
  while (Date.now() < deadline) {
    const pollRes = await fetch(
      `${env.ATLASCLOUD_BASE_URL}/api/v1/model/prediction/${predictionId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );

    if (!pollRes.ok) {
      const text = await pollRes.text();
      throw new Error(`Atlas prediction failed (${pollRes.status}): ${text}`);
    }

    const pollJson = (await pollRes.json()) as {
      data?: { status?: string; outputs?: string[]; error?: string };
    };
    const status = pollJson.data?.status ?? "processing";

    if (status === "completed" || status === "succeeded") {
      imageUrl = pollJson.data?.outputs?.[0];
      break;
    }

    if (status === "failed") {
      throw new Error(pollJson.data?.error || "Atlas image generation failed");
    }

    await new Promise((r) => setTimeout(r, env.ATLASCLOUD_POLL_INTERVAL_MS));
  }

  if (!imageUrl) {
    throw new Error("Timed out waiting for Atlas image generation");
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error("Failed to download generated Atlas image URL");
  }
  const buf = Buffer.from(await imageRes.arrayBuffer());
  const mimeType = imageRes.headers.get("content-type") ?? "image/png";
  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${buf.toString("base64")}`,
  };
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const input = characterSheetRequestSchema.parse(json);
    const prompt = buildCharacterSheetPrompt(input);
    const { dataUrl, mimeType } = await atlasImageAsDataUrl(prompt);

    return NextResponse.json({ mimeType, imageDataUrl: dataUrl });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to generate character sheet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
