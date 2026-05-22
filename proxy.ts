import { type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/session-user";
import { applyRouteGuard } from "@/lib/supabase/route-guard";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return updateSession(request);
  }

  const sessionResponse = await updateSession(request);
  const user = await getSessionUser();

  return applyRouteGuard(request, sessionResponse, user);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
