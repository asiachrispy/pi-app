import { NextResponse } from "next/server";
import { listAllSessions, listProjectCwdsForPicker } from "@/lib/session-reader";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { filterLivoOwnedCwdsForRequest, filterLivoOwnedResourcesForRequest } from "@/lib/livo-sso";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

export const GET = withTenant(async (req: Request) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  try {
    const agentDir = currentAgentDir();
    const [sessions, projectCwds] = await Promise.all([
      listAllSessions(agentDir),
      listProjectCwdsForPicker(agentDir),
    ]);
    return NextResponse.json({
      sessions: filterLivoOwnedResourcesForRequest(req, sessions),
      projectCwds: filterLivoOwnedCwdsForRequest(req, projectCwds),
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
});
