import { NextResponse } from "next/server";
import { readLivoSession } from "@/lib/livo-sso";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

export async function GET(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const session = readLivoSession(req);
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json({
    user: {
      userId: session.livoUserId,
      email: session.email,
      name: session.name,
    },
  });
}
