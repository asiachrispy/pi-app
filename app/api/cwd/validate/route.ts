import { NextResponse } from "next/server";
import { statSync, type Stats } from "fs";
import { homedir } from "os";
import { isAbsolute, resolve } from "path";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { rememberWorkspaceCwd } from "@/lib/pi-web-preferences";
import { invalidateAllowedRootsCache } from "@/lib/allowed-roots-cache";
import { readLivoSession, resolveLivoUserWorkspacePath } from "@/lib/livo-sso";
import { allowFileRoot } from "@/lib/file-access";
import { projectIdentityKey } from "@/lib/project-identity";
import { resolveProject } from "@/lib/worktree";

function normalizeCwd(cwd: string): string {
  if (cwd === "~") return homedir();
  if (cwd.startsWith("~/")) return resolve(homedir(), cwd.slice(2));
  return isAbsolute(cwd) ? cwd : resolve(cwd);
}

// POST /api/cwd/validate  body: { cwd: string }
// Validates a candidate workspace before the UI selects it.
export async function POST(req: Request) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as { cwd?: unknown };
    const cwd = typeof body.cwd === "string" ? body.cwd.trim() : "";

    if (!cwd) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    const livoSession = readLivoSession(req);
    const livoCwd = livoSession ? resolveLivoUserWorkspacePath(cwd, livoSession.livoUserId) : null;
    if (livoSession && !livoCwd) {
      return NextResponse.json({ error: "Path is outside current Livo workspace" }, { status: 403 });
    }
    const normalizedCwd = livoCwd ?? normalizeCwd(cwd);
    let stat: Stats;
    try {
      stat = statSync(normalizedCwd);
    } catch {
      return NextResponse.json({ error: `Directory does not exist: ${cwd}` }, { status: 400 });
    }

    if (!stat.isDirectory()) {
      return NextResponse.json({ error: `Path is not a directory: ${cwd}` }, { status: 400 });
    }

    try {
      rememberWorkspaceCwd(normalizedCwd);
      allowFileRoot(normalizedCwd);
      // The directory just entered the recent list — drop the cached allowed-roots
      // set so the next file request authorizes it immediately instead of 403-ing
      // until the TTL lapses.
      invalidateAllowedRootsCache();
    } catch {
      // Best-effort: failing to persist the recent-workspaces list must not turn
      // a successful validation into an error response.
    }
    const project = await resolveProject(normalizedCwd);
    return NextResponse.json({
      success: true,
      cwd: normalizedCwd,
      projectRoot: project.projectRoot,
      projectKey: projectIdentityKey(project.projectRoot),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
