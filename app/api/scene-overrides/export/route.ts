import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { withTenant } from "@/lib/livo/with-tenant";
import { readSceneOverrides } from "@/lib/scene-overrides";
import { buildScenePack } from "@/lib/scene-pack";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (req: Request) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const sceneId = url.searchParams.get("sceneId");
  const pack = buildScenePack(readSceneOverrides(), sceneId);
  const filename = sceneId ? `scene-${sceneId}.pi-scene-pack.json` : "scenes.pi-scene-pack.json";

  return new NextResponse(`${JSON.stringify(pack, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
});
