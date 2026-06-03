import { NextResponse } from "next/server";
import { homedir } from "os";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  return NextResponse.json({ home: homedir() });
}
