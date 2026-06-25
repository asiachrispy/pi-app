import { NextResponse } from "next/server";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { resolveSessionPath, buildSessionContext } from "@/lib/session-reader";
import { requireApiAuth } from "@/lib/api-auth";
import { rejectLivoCwdOutsideWorkspace } from "@/lib/livo-session-guard";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

export const GET = withTenant(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  const { id } = await params;
  const url = new URL(req.url);
  const leafId = url.searchParams.get("leafId") ?? undefined;

  try {
    const filePath = await resolveSessionPath(id, currentAgentDir());
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sm = SessionManager.open(filePath);
    const rejectedByOwner = rejectLivoCwdOutsideWorkspace(req, sm.getHeader()?.cwd);
    if (rejectedByOwner) return rejectedByOwner;
    const context = buildSessionContext(sm.getEntries() as never, leafId);

    return NextResponse.json({ context });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
