import { mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
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

// POST /api/livo/workspace  body: { userId: string; meetingId: string }
// Creates the narrow Livo workspace used by server-to-server Livo dispatch.
export async function POST(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as {
      userId?: unknown;
      meetingId?: unknown;
      summary?: unknown;
      todos?: unknown;
      transcript?: unknown;
    };
    const userId = safeSegment(body.userId, "userId");
    if (userId instanceof NextResponse) return userId;
    const meetingId = safeSegment(body.meetingId, "meetingId");
    if (meetingId instanceof NextResponse) return meetingId;

    const root = livoRoot();
    const cwd = resolve(root, "users", userId);
    const meetingPath = resolve(cwd, "meetings", meetingId);
    mkdirSync(cwd, { recursive: true });
    mkdirSync(join(meetingPath, "inputs"), { recursive: true });
    mkdirSync(join(meetingPath, "working"), { recursive: true });
    mkdirSync(join(meetingPath, "outputs"), { recursive: true });
    writeInputFile(
      meetingPath,
      "meeting-brief.md",
      `# Meeting Brief\n\n## Summary\n${stringInput(body.summary)}\n\n## Todos\n${stringInput(body.todos)}\n`
    );
    writeInputFile(meetingPath, "transcript.txt", body.transcript);
    invalidateAllowedRootsCache();
    const workspaceId = `livo:${userId}`;
    const publicOrigin = process.env.PI_PUBLIC_ORIGIN || "https://pi.gottao.com";
    const workspaceUrl = `${publicOrigin.replace(/\/+$/, "")}/app/?workspace=${encodeURIComponent(workspaceId)}&meeting=${encodeURIComponent(meetingId)}`;
    return NextResponse.json({ success: true, workspaceId, meetingId, cwd, meetingPath, workspaceUrl });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function writeInputFile(meetingPath: string, name: string, value: unknown) {
  if (typeof value !== "string") return;
  writeFileSync(join(meetingPath, "inputs", name), value);
}

function stringInput(value: unknown): string {
  return typeof value === "string" ? value : "";
}
