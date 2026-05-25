import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { frameSequenceSheetRequestSchema } from "@/lib/schemas";
import { generateFrameSequenceSheetWithOpenAI } from "@/lib/openai/images";
import { buildFrameSequenceSheetPrompt } from "@/lib/prompts/frame-sequence-sheet";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const json = await req.json();
    const input = frameSequenceSheetRequestSchema.parse(json);
    const normalizedRefUrls = (input.referenceImageUrls ?? []).map((url) =>
      url.trim().startsWith("/")
        ? new URL(url.trim(), req.url).toString()
        : url.trim(),
    );
    const prompt = buildFrameSequenceSheetPrompt({
      ...input,
      referenceImageUrls: normalizedRefUrls,
    });
    const { dataUrl, mimeType } = await generateFrameSequenceSheetWithOpenAI({
      prompt,
      requestUrl: req.url,
      referenceImageUrls: normalizedRefUrls,
    });

    return NextResponse.json({ mimeType, imageDataUrl: dataUrl });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate frame sequence sheet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
