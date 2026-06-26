import { NextResponse } from "next/server";
import { livoSessionExistsBySessionId } from "@/lib/livo-sso";
import { remoteSessionExistsBySessionId } from "@/lib/remote-auth";
import { getBearerToken, isLoopbackRequest, timingSafeEqualString } from "@/lib/request-auth-common";

export const dynamic = "force-dynamic";

function resolveSessionKind(raw: string | null): "livo" | "remote" {
  return raw?.trim().toLowerCase() === "remote" ? "remote" : "livo";
}

export async function GET(req: Request) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json({ error: "Internal session verify is loopback-only" }, { status: 403 });
  }

  const expected = process.env.PI_INTERNAL_VERIFY_TOKEN?.trim();
  const bearer = getBearerToken(req);
  if (!expected || !bearer || !timingSafeEqualString(bearer, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sid = url.searchParams.get("sid")?.trim();
  if (!sid) {
    return NextResponse.json({ error: "sid required" }, { status: 400 });
  }

  const kind = resolveSessionKind(url.searchParams.get("kind"));
  const exists = kind === "remote"
    ? remoteSessionExistsBySessionId(sid)
    : livoSessionExistsBySessionId(sid);

  return NextResponse.json({ exists, kind });
}
