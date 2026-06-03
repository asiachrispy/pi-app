import { NextResponse } from "next/server";
import {
  buildSessionSetCookie,
  getPublicRemoteStatus,
  isRemoteAccessEnabled,
  redeemPairingCode,
} from "@/lib/remote-auth";

export async function POST(req: Request) {
  if (!isRemoteAccessEnabled()) {
    return NextResponse.json({ error: "Remote access is not enabled" }, { status: 403 });
  }

  try {
    const body = await req.json() as { code?: string };
    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const { cookieValue, maxAgeSec } = redeemPairingCode(req, body.code);
    const response = NextResponse.json({ success: true, status: getPublicRemoteStatus() });
    response.headers.append("Set-Cookie", buildSessionSetCookie(req, cookieValue, maxAgeSec));
    return response;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
