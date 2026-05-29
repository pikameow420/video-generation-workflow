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
    const normalizeUrl = (url: string) =>
      url.trim().startsWith("/")
        ? new URL(url.trim(), req.url).toString()
        : url.trim();

    const normalizedRefUrls = (input.referenceImageUrls ?? []).map(normalizeUrl);
    const anchors = input.characterAnchors ?? [];
    const anchorSheetUrls = anchors.map((a) => normalizeUrl(a.characterSheetUrl));
    const anchorExtraRefs = anchors.flatMap((a) =>
      (a.referenceImageUrls ?? []).map(normalizeUrl),
    );
    const openAiImageUrls = [
      ...anchorSheetUrls,
      ...anchorExtraRefs,
      ...normalizedRefUrls,
    ].slice(0, 9);

    const prompt = buildFrameSequenceSheetPrompt({
      scriptTitle: input.scriptTitle,
      scriptBody: input.scriptBody,
      artDirection: input.artDirection,
      referenceImageUrls: openAiImageUrls.length ? openAiImageUrls : undefined,
      characterAnchors: anchors.length
        ? anchors.map((a) => ({
            name: a.name,
            characterSheetUrl: normalizeUrl(a.characterSheetUrl),
            referenceImageUrls: a.referenceImageUrls?.map(normalizeUrl),
          }))
        : undefined,
    });
    const { dataUrl, mimeType } = await generateFrameSequenceSheetWithOpenAI({
      prompt,
      requestUrl: req.url,
      referenceImageUrls: openAiImageUrls.length ? openAiImageUrls : undefined,
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
        : "Failed to generate Video Sheet";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
