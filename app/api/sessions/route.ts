import { NextResponse } from "next/server";
import { listAllSessions, listProjectCwdsForPicker } from "@/lib/session-reader";
import { requireApiAuth } from "@/lib/api-auth";
import { cwdBelongsToLivoUser, readLivoSession } from "@/lib/livo-sso";

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const [sessions, projectCwds] = await Promise.all([
      listAllSessions(),
      listProjectCwdsForPicker(),
    ]);
    const livoSession = readLivoSession(req);
    if (!livoSession) {
      return NextResponse.json({ sessions, projectCwds });
    }

    return NextResponse.json({
      sessions: sessions.filter((session) => cwdBelongsToLivoUser(session.cwd, livoSession.livoUserId)),
      projectCwds: projectCwds.filter((cwd) => cwdBelongsToLivoUser(cwd, livoSession.livoUserId)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
