import { NextResponse } from "next/server";
import { cwdBelongsToLivoUser, readLivoSession } from "@/lib/livo-sso";

export function hasLivoSession(req: Request): boolean {
  return Boolean(readLivoSession(req));
}

export function rejectLivoCwdOutsideWorkspace(
  req: Request,
  cwd: string | null | undefined,
): NextResponse | null {
  const livoSession = readLivoSession(req);
  if (!livoSession) return null;
  if (cwdBelongsToLivoUser(cwd, livoSession.livoUserId)) return null;
  return NextResponse.json({ error: "Session is outside current Livo workspace" }, { status: 403 });
}
