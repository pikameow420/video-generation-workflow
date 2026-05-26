import { NextResponse } from "next/server";

import { getVideoQuotaStatus } from "@/lib/auth/video-quota";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  return NextResponse.json(await getVideoQuotaStatus(auth.user));
}
