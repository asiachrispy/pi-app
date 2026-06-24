import { mkdirSync } from "fs";
import { homedir } from "os";
import { isAbsolute, join, relative, resolve } from "path";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { invalidateAllowedRootsCache } from "@/lib/allowed-roots-cache";

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

function livoRoot(): string {
  return resolve(process.env.PI_WEB_LIVO_WORKSPACE_ROOT || join(homedir(), "livo"));
}

function safeSegment(value: unknown, field: string): string | NextResponse {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) {
    return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
  }
  return value;
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// POST /api/livo/workspace  body: { userId: string; meetingId: string }
// Creates the narrow Livo workspace used by server-to-server Livo dispatch.
export async function POST(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as { userId?: unknown; meetingId?: unknown };
    const userId = safeSegment(body.userId, "userId");
    if (userId instanceof NextResponse) return userId;
    const meetingId = safeSegment(body.meetingId, "meetingId");
    if (meetingId instanceof NextResponse) return meetingId;

    const root = livoRoot();
    const cwd = resolve(root, "users", userId, "meetings", meetingId);
    if (!isInside(root, cwd)) {
      return NextResponse.json({ error: "Workspace escapes Livo root" }, { status: 400 });
    }

    mkdirSync(cwd, { recursive: true });
    invalidateAllowedRootsCache();
    return NextResponse.json({ success: true, cwd });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
