import { NextResponse } from "next/server";
import { readSceneOverride } from "@/lib/scene-overrides";
import { getActionsForScene, getSceneByIdWithOverride, getSourcesForScene } from "@/lib/scenes";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = requireApiAuth(req);
  if (rejected) return rejected;

  const { id } = await params;
  const scene = getSceneByIdWithOverride(id, readSceneOverride(id));
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  return NextResponse.json({
    scene,
    actions: getActionsForScene(scene),
    sources: getSourcesForScene(scene),
  });
}
