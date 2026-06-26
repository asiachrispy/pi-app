import { NextResponse } from "next/server";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { withTenant } from "@/lib/livo/with-tenant";
import { readSceneOverrides } from "@/lib/scene-overrides";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (req: Request) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  return NextResponse.json({ overrides: readSceneOverrides() });
});
