import { NextResponse } from "next/server";
import {
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
  rejectUnauthorizedRequest,
} from "@/lib/remote-auth";
import { readRemoteAuditEvents } from "@/lib/remote-audit-log";

function requireLocalManagement(req: Request): NextResponse | null {
  if (isLoopbackRequest(req) && isSameOriginLoopbackRequest(req)) {
    return null;
  }
  return rejectUnauthorizedRequest(req);
}

export async function GET(req: Request) {
  const localOnly = requireLocalManagement(req);
  if (localOnly) return localOnly;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(Number(limitRaw) || 100, 500) : 100;
  return NextResponse.json({ events: readRemoteAuditEvents(limit) });
}
