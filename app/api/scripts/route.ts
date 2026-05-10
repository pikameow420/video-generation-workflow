import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { scriptsRequestSchema, scriptsResponseSchema } from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import {
  buildScriptSystemMessage,
  buildScriptUserMessage,
} from "@/lib/prompts/scripts";

export const runtime = "nodejs";

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Fall through to fenced/plain extraction.
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  if (fenced) {
    return JSON.parse(fenced.trim());
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("Model did not return parseable JSON");
}

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const apiKey = env.ATLASCLOUD_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "ATLASCLOUD_API_KEY is required for script generation" },
        { status: 500 },
      );
    }

    const json = await req.json();
    const input = scriptsRequestSchema.parse(json);
    // TODO: Add auth checks before allowing team users to generate or reuse scripts.

    const userLines = buildScriptUserMessage(input);
    const systemMessage = buildScriptSystemMessage(
      input.basePrompt,
      input.brandKit,
    );

    const completionRes = await fetch(
      `${env.ATLASCLOUD_BASE_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.ATLASCLOUD_SCRIPT_MODEL,
          temperature: 0.7,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            { role: "user", content: userLines },
          ],
        }),
      },
    );

    if (!completionRes.ok) {
      const text = await completionRes.text();
      return NextResponse.json(
        { error: `Atlas script generation failed (${completionRes.status}): ${text}` },
        { status: 502 },
      );
    }

    const completion = (await completionRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No script content from model" },
        { status: 502 },
      );
    }

    const parsed = extractJsonObject(content);
    const scripts = scriptsResponseSchema.parse(parsed);
    return NextResponse.json(scripts);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to generate scripts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
