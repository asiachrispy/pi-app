import { NextResponse } from "next/server";
import { normalizePiReturnTo } from "@/lib/livo-sso";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

export async function GET(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const url = new URL(req.url);
  let returnTo: string;
  try {
    returnTo = normalizePiReturnTo(url.searchParams.get("returnTo"));
  } catch {
    return NextResponse.json({ error: "returnTo is not allowed" }, { status: 400 });
  }
  const login = new URL(process.env.PI_LIVO_WEB_LOGIN_URL ?? "https://livo.gottao.com/auth/login");
  login.searchParams.set("redirect", `/pi-sso?returnTo=${encodeURIComponent(returnTo)}`);
  return NextResponse.redirect(login);
}
