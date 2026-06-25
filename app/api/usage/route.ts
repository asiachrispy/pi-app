import { NextResponse } from "next/server";
import { listAllSessions } from "@/lib/session-reader";
import { readProductSessionMetadataMap } from "@/lib/scene-metadata";
import { buildHistoryItems } from "@/lib/product-history";
import { buildUsageSummary, buildUsageTimeline } from "@/lib/usage";
import { requireApiAuth } from "@/lib/api-auth";
import { filterLivoOwnedResourcesForRequest } from "@/lib/livo-sso";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { buildTenantTokenUsage } from "@/lib/livo/tenant-usage";
import { withTenant } from "@/lib/livo/with-tenant";

export const GET = withTenant(async (req: Request) => {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? Math.min(30, Math.max(1, Number.parseInt(daysParam, 10) || 7)) : null;

    const agentDir = currentAgentDir();
    const sessions = filterLivoOwnedResourcesForRequest(req, await listAllSessions(agentDir));
    const metadata = readProductSessionMetadataMap();
    const history = buildHistoryItems(sessions, metadata);
    const usage = buildUsageSummary(history);
    // per-tenant token/cost：基于已过滤的本租户 session 聚合（只展示，不拦截）。
    const tokenUsage = await buildTenantTokenUsage(agentDir, sessions);
    if (days === null) {
      return NextResponse.json({ usage, tokenUsage });
    }
    return NextResponse.json({
      usage,
      tokenUsage,
      timeline: buildUsageTimeline(history, days),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
