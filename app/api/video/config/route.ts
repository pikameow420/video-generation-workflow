import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const env = getEnv();
  return NextResponse.json({
    atlasConfigured: Boolean(env.ATLASCLOUD_API_KEY?.trim()),
    muapiConfigured: Boolean(env.MUAPI_API_KEY?.trim()),
    defaultProvider: env.VIDEO_PROVIDER,
  });
}
