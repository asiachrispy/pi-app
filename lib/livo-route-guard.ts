import { NextResponse } from "next/server";
import { isLivoIntegrationEnabled } from "@/lib/livo-sso";

export function rejectLivoIntegrationDisabled(): NextResponse | null {
  if (isLivoIntegrationEnabled()) return null;
  return NextResponse.json({ error: "Livo integration is disabled" }, { status: 404 });
}
