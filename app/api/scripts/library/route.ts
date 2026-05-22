import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  saveScriptRequestSchema,
  savedScriptListResponseSchema,
} from "@/lib/schemas";
import { listSavedScripts, putSavedScript } from "@/lib/scripts/store";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const items = await listSavedScripts(auth.user.id);
    const validated = savedScriptListResponseSchema.parse({ items });
    return NextResponse.json(validated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list saved scripts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const json = await req.json();
    const body = saveScriptRequestSchema.parse(json);
    const item = await putSavedScript({
      title: body.title,
      body: body.body,
      source: body.source ?? "manual",
    }, auth.user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to save script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
