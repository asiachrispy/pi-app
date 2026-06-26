import { NextResponse } from "next/server";
import { listAllSessions } from "@/lib/session-reader";
import { readProductSessionMetadataMap } from "@/lib/scene-metadata";
import { buildHistoryItems } from "@/lib/product-history";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { filterLivoOwnedResourcesForRequest } from "@/lib/livo-sso";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

export const GET = withTenant(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  try {
    const { id } = await params;
    const sessions = filterLivoOwnedResourcesForRequest(req, await listAllSessions(currentAgentDir()));
    const item = buildHistoryItems(sessions, readProductSessionMetadataMap())
      .find((historyItem) => historyItem.sessionId === id);

    if (!item) {
      return NextResponse.json({ error: "History item not found" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
