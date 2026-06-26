import { NextResponse } from "next/server";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { withTenant } from "@/lib/livo/with-tenant";
import { isKnownSceneId } from "@/lib/scenes";
import {
  clearSceneOverride,
  upsertSceneOverride,
  validateSceneOverrideBody,
} from "@/lib/scene-overrides";

export const dynamic = "force-dynamic";

export const PUT = withTenant(async (
  req: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) => {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  const { sceneId } = await params;
  if (!isKnownSceneId(sceneId)) {
    return NextResponse.json({ error: `Unknown scene: ${sceneId}` }, { status: 404 });
  }

  try {
    const body = await req.json();
    const validated = validateSceneOverrideBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const override = await upsertSceneOverride(sceneId, validated.value);
    return NextResponse.json({ override });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});

export const DELETE = withTenant(async (
  req: Request,
  { params }: { params: Promise<{ sceneId: string }> },
) => {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  const { sceneId } = await params;
  if (!isKnownSceneId(sceneId)) {
    return NextResponse.json({ error: `Unknown scene: ${sceneId}` }, { status: 404 });
  }

  try {
    const removed = await clearSceneOverride(sceneId);
    return NextResponse.json({ removed });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
