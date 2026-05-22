import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

const AUTH_PATH_PREFIXES = ["/login", "/auth"];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return false;
  }
  if (isAuthPath(pathname)) {
    return false;
  }
  return pathname === "/" || pathname.startsWith("/library");
}

export function applyRouteGuard(
  request: NextRequest,
  sessionResponse: NextResponse,
  user: User | null,
): NextResponse {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    return NextResponse.redirect(new URL(next, request.url));
  }

  return sessionResponse;
}
