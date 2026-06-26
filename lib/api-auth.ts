import { NextResponse } from "next/server";
import type { AuthPrincipal } from "@/lib/auth/principal";
import { rejectUnauthorizedRequest, resolveAuthPrincipal } from "@/lib/remote-auth";

export type { AuthPrincipal } from "@/lib/auth/principal";
export { isLivoPrincipal, livoPrincipalFromSession, principalReadOnly } from "@/lib/auth/principal";
export { resolveAuthPrincipal, resolveLivoPrincipal } from "@/lib/remote-auth";

export function isAuthError(result: AuthPrincipal | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/** 鉴权通过返回 AuthPrincipal，失败返回 NextResponse。 */
export function requireApiAuth(req: Request): AuthPrincipal | NextResponse {
  const rejected = rejectUnauthorizedRequest(req);
  if (rejected) return rejected;
  const principal = resolveAuthPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return principal;
}
