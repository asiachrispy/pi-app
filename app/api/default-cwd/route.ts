import { NextResponse } from "next/server";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { livoUserWorkspaceRoot, readLivoSession } from "@/lib/livo-sso";
import { allowFileRoot } from "@/lib/file-access";

// POST /api/default-cwd
// Creates ~/pi-cwd-<YYYYMMDD> if it doesn't exist and returns the path.
export async function POST(req: Request) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  try {
    const livoSession = readLivoSession(req);
    if (livoSession) {
      const dir = livoUserWorkspaceRoot(livoSession.livoUserId);
      mkdirSync(dir, { recursive: true });
      allowFileRoot(dir);
      return NextResponse.json({ cwd: dir });
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const dir = join(homedir(), `pi-cwd-${date}`);
    mkdirSync(dir, { recursive: true });
    allowFileRoot(dir);
    return NextResponse.json({ cwd: dir });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
