import { NextResponse } from "next/server";
import { homedir } from "os";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  return NextResponse.json({ home: homedir() });
}
