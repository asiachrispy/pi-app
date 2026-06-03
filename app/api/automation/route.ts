import { NextResponse } from "next/server";
import { getAutomationEntries } from "@/lib/automation";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  return NextResponse.json({ automation: getAutomationEntries() });
}
