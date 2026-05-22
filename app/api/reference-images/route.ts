import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  allowedReferenceImageMimeTypes,
  maxReferenceImageBytes,
  referenceImageListResponseSchema,
} from "@/lib/schemas";
import {
  deleteReferenceImage,
  listReferenceImages,
  putReferenceImage,
  ReferenceImageNotFoundError,
} from "@/lib/uploads/store";
import { requireUser } from "@/lib/auth/require-user";

const deleteQuerySchema = z.object({
  id: z.uuid(),
});

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
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const items = await listReferenceImages(auth.user.id);
    const validated = referenceImageListResponseSchema.parse({ items });
    return NextResponse.json(validated);
  } catch (err) {
    return NextResponse.json(
      { error: parseErrorMessage(err, "Failed to list reference images") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const url = new URL(req.url);
    const parsed = deleteQuerySchema.safeParse({
      id: url.searchParams.get("id"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 },
      );
    }

    await deleteReferenceImage(parsed.data.id, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ReferenceImageNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: parseErrorMessage(err, "Failed to delete reference image") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

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
    }, auth.user.id);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    const message = parseErrorMessage(err, "Failed to upload reference image");
    const status = err instanceof ZodError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
