import { NextResponse } from "next/server";
import { appendRequestAuditEvent } from "@/lib/audit-request";
import { deleteLivoSession, LIVO_SESSION_COOKIE_NAME, readLivoSession } from "@/lib/livo-sso";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

export async function POST(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const session = readLivoSession(req);
  if (session) {
    appendRequestAuditEvent(req, {
      type: "livo_logout",
      tenantId: session.livoUserId,
      principalKind: "livo",
    });
  }

  deleteLivoSession(req);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LIVO_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
