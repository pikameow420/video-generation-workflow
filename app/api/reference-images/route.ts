import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  allowedReferenceImageMimeTypes,
  maxReferenceImageBytes,
  referenceImageListResponseSchema,
} from "@/lib/schemas";
import { listReferenceImages, putReferenceImage } from "@/lib/uploads/store";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => issue.message).join("; ");
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export async function GET() {
  try {
    const items = await listReferenceImages();
    const validated = referenceImageListResponseSchema.parse({ items });
    return NextResponse.json(validated);
  } catch (err) {
    return NextResponse.json(
      { error: parseErrorMessage(err, "Failed to list reference images") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (!(entry instanceof File)) {
      return NextResponse.json(
        { error: "file is required as multipart/form-data" },
        { status: 400 },
      );
    }

    if (!allowedReferenceImageMimeTypes.includes(entry.type as (typeof allowedReferenceImageMimeTypes)[number])) {
      return NextResponse.json(
        {
          error:
            "Unsupported image type. Allowed: image/jpeg, image/png, image/webp",
        },
        { status: 400 },
      );
    }

    if (entry.size > maxReferenceImageBytes) {
      return NextResponse.json(
        {
          error: `Image is too large. Max size is ${Math.round(maxReferenceImageBytes / (1024 * 1024))}MB`,
        },
        { status: 400 },
      );
    }

    const data = new Uint8Array(await entry.arrayBuffer());
    const saved = await putReferenceImage({
      bytes: data,
      mimeType: entry.type,
      originalName: entry.name || "reference-image",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    const message = parseErrorMessage(err, "Failed to upload reference image");
    const status = err instanceof ZodError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
