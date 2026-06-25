import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { livoUserWorkspaceRoot, readLivoSession } from "@/lib/livo-sso";
import { invalidateAllowedRootsCache } from "@/lib/allowed-roots-cache";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

export async function GET(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  const livoSession = readLivoSession(req);
  if (!livoSession) {
    return NextResponse.json({ error: "Livo session required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspace") ?? "";
  const expectedWorkspaceId = `livo:${livoSession.livoUserId}`;
  if (workspaceId !== expectedWorkspaceId) {
    return NextResponse.json({ error: "Workspace not allowed" }, { status: 403 });
  }

  const meetingId = url.searchParams.get("meeting") ?? "";
  if (meetingId && !SAFE_SEGMENT.test(meetingId)) {
    return NextResponse.json({ error: "Invalid meetingId" }, { status: 400 });
  }

  const cwd = livoUserWorkspaceRoot(livoSession.livoUserId);
  mkdirSync(cwd, { recursive: true });
  const meetingPath = meetingId ? join(cwd, "meetings", meetingId) : null;
  if (meetingPath) {
    mkdirSync(join(meetingPath, "inputs"), { recursive: true });
    mkdirSync(join(meetingPath, "working"), { recursive: true });
    mkdirSync(join(meetingPath, "outputs"), { recursive: true });
  }
  invalidateAllowedRootsCache();

  return NextResponse.json({
    workspaceId,
    meetingId: meetingId || undefined,
    cwd,
    meetingPath,
  });
}
