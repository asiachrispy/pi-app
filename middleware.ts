import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeMiddlewareRequest, hasValidLivoSessionWithStore, hasValidRemoteSessionWithStore, isRemoteAccessEnabledEnv } from "./lib/middleware-auth";
import { isLivoSsoEnabled } from "./lib/livo/sso-flags";
import {
  buildSsoStartUrl,
  isWorkbenchEntry,
  resolveWorkbenchBasePath,
  workbenchEntryPathname,
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
  if (pathname === "/api/internal/session/exists") {
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
    if (!await hasValidLivoSessionWithStore(request)) {
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

  // Remote / Livo cookies require HMAC + store when PI_INTERNAL_VERIFY_TOKEN is set (#11b / #11c).
  if (await hasValidRemoteSessionWithStore(request)) {
    return NextResponse.next();
  }
  if (await hasValidLivoSessionWithStore(request)) {
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
  // Next.js 要求 matcher 为编译期字面量；prod 默认工作台 /app（见 workbench.ts）
  matcher: ["/", "/app", "/app/", "/api/:path*"],
};
