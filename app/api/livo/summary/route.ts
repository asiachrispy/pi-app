import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { isAbsolute, join, relative, resolve } from "path";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { rejectLivoIntegrationDisabled } from "@/lib/livo-route-guard";

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

function livoRoot(): string {
  return resolve(process.env.PI_WEB_LIVO_WORKSPACE_ROOT || join(homedir(), "livo"));
}

function pathBelongsToRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && rel !== ".." && !isAbsolute(rel));
}

// GET /api/livo/summary?userId=...&meeting=...
// Server-to-server read-only pull of a meeting's outputs/summary.md.
// Used by Livo backend during its collaboration poll. Returns
// { exists, summary }. Never throws on a missing file — absence just means
// the run has not wrapped yet.
export async function GET(req: Request) {
  const disabled = rejectLivoIntegrationDisabled();
  if (disabled) return disabled;

  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  const meetingId = url.searchParams.get("meeting") ?? "";
  if (!SAFE_SEGMENT.test(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!SAFE_SEGMENT.test(meetingId)) {
    return NextResponse.json({ error: "Invalid meeting" }, { status: 400 });
  }

  // Resolve strictly under the user's own workspace; reject any escape.
  const userRoot = resolve(livoRoot(), "users", userId);
  const summaryPath = resolve(userRoot, "meetings", meetingId, "outputs", "summary.md");
  if (!pathBelongsToRoot(userRoot, summaryPath)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  if (!existsSync(summaryPath)) {
    return NextResponse.json({ exists: false, summary: "" });
  }

  try {
    const summary = readFileSync(summaryPath, "utf8");
    return NextResponse.json({ exists: true, summary });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
