import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasBearerPrefix, getSessionCookie } from "./lib/request-auth-common";
import { authorizeMiddlewareRequest, hasValidLivoSessionCookie, isRemoteAccessEnabledEnv } from "./lib/middleware-auth";
import { isLivoSsoEnabled } from "./lib/livo/config";
import {
  buildSsoStartUrl,
  isWorkbenchEntry,
  resolveWorkbenchBasePath,
  workbenchEntryPathname,
  workbenchMiddlewareMatchers,
  WORKBENCH_ENTRY_HEADER,
} from "./lib/livo/workbench";

function isPublicSharePath(pathname: string): boolean {
  return pathname === "/api/share" || pathname.startsWith("/api/share/");
}

function isPublicApiRequest(pathname: string, method: string): boolean {
  if (isPublicSharePath(pathname)) {
    return method === "GET" || method === "HEAD" || method === "OPTIONS";
  }
  if (pathname === "/api/remote/pair") {
    return method === "POST";
  }
  if (pathname === "/api/remote/client" || pathname === "/api/health") {
    return method === "GET" || method === "HEAD" || method === "OPTIONS";
  }
  if (pathname === "/api/livo/sso/start" || pathname === "/api/livo/sso/callback") {
    return method === "GET" || method === "HEAD" || method === "OPTIONS";
  }
  return false;
}

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 401 });
}

function forbidden(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isLivoSsoEnabled() && isWorkbenchEntry(pathname, request.headers)) {
    if (!await hasValidLivoSessionCookie(request)) {
      const start = new URL("/api/livo/sso/start", request.url);
      const useWorkbenchPath = pathname === workbenchEntryPathname()
        || pathname === resolveWorkbenchBasePath()
        || request.headers.get(WORKBENCH_ENTRY_HEADER) === workbenchEntryPathname();
      const appPath = useWorkbenchPath ? resolveWorkbenchBasePath() : pathname;
      start.searchParams.set("returnTo", `${appPath}${request.nextUrl.search}`);
      return NextResponse.redirect(start);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiRequest(pathname, request.method)) {
    return NextResponse.next();
  }

  // Bearer tokens and session cookies are verified in route handlers (disk-backed auth).
  if (hasBearerPrefix(request)) {
    return NextResponse.next();
  }
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }
  if (await hasValidLivoSessionCookie(request)) {
    return NextResponse.next();
  }

  const auth = await authorizeMiddlewareRequest(request);
  if (!auth.authorized) {
    if (!isRemoteAccessEnabledEnv() && !auth.loopback) {
      return forbidden(auth.reason ?? "Remote access is disabled");
    }
    return unauthorized(auth.reason ?? "Authentication required");
  }

  if (auth.readOnly && request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    return forbidden("Remote access is read-only");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", ...workbenchMiddlewareMatchers(), "/api/:path*"],
};
