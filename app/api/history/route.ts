import { NextResponse } from "next/server";
import { listAllSessions } from "@/lib/session-reader";
import { readProductSessionMetadataMap } from "@/lib/scene-metadata";
import { buildHistoryItems } from "@/lib/product-history";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { filterLivoOwnedResourcesForRequest } from "@/lib/livo-sso";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

export const GET = withTenant(async (req: Request) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  try {
    const sessions = filterLivoOwnedResourcesForRequest(req, await listAllSessions(currentAgentDir()));
    const metadata = readProductSessionMetadataMap();
    return NextResponse.json({ history: buildHistoryItems(sessions, metadata) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
