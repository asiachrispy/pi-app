import { NextResponse } from "next/server";
import { listAllSessions } from "@/lib/session-reader";
import { readProductSessionMetadataMap } from "@/lib/scene-metadata";
import { buildHistoryItems } from "@/lib/product-history";
import { requireApiAuth } from "@/lib/api-auth";
import { filterLivoOwnedResourcesForRequest } from "@/lib/livo-sso";

export async function GET(req: Request) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  try {
    const sessions = filterLivoOwnedResourcesForRequest(req, await listAllSessions());
    const metadata = readProductSessionMetadataMap();
    return NextResponse.json({ history: buildHistoryItems(sessions, metadata) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
