import { NextResponse } from "next/server";
import { deleteLivoSession, LIVO_SESSION_COOKIE_NAME } from "@/lib/livo-sso";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

export async function POST(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

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
