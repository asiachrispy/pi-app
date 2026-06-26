import { NextResponse } from "next/server";
import { appendRemoteAuditEvent, getClientIp } from "@/lib/remote-audit-log";
import {
  createLivoSession,
  LIVO_SESSION_COOKIE_NAME,
  normalizePiReturnTo,
} from "@/lib/livo-sso";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

interface LivoVerifyResponse {
  code?: number;
  data?: {
    userId?: string;
    email?: string;
    name?: string;
    returnTo?: string;
  };
  message?: string;
}

export async function GET(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const url = new URL(req.url);
  const ticket = url.searchParams.get("ticket");
  if (!ticket) return NextResponse.json({ error: "ticket required" }, { status: 400 });

  const baseUrl = process.env.PI_LIVO_BASE_URL ?? "https://livo.gottao.com/livoApi/livoAgent";
  const verifyToken = process.env.PI_LIVO_SSO_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "PI_LIVO_SSO_VERIFY_TOKEN missing" }, { status: 500 });
  }

  const verify = await fetch(`${baseUrl}/pi-sso/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${verifyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticket }),
  });
  const body = await verify.json() as LivoVerifyResponse;
  if (!verify.ok || body.code !== 200 || !body.data?.userId) {
    return NextResponse.json({ error: body.message ?? "SSO verify failed" }, { status: 401 });
  }

  let returnTo: string;
  try {
    returnTo = normalizePiReturnTo(body.data.returnTo);
  } catch {
    return NextResponse.json({ error: "returnTo is not allowed" }, { status: 400 });
  }
  const session = createLivoSession({
    livoUserId: body.data.userId,
    email: body.data.email,
    name: body.data.name,
  });
  appendRemoteAuditEvent({
    type: "livo_sso_success",
    tenantId: body.data.userId,
    principalKind: "livo",
    ip: getClientIp(req),
    path: "/api/livo/sso/callback",
    method: "GET",
  });
  const response = NextResponse.redirect(returnTo);
  response.cookies.set(LIVO_SESSION_COOKIE_NAME, session.cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
