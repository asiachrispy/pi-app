import { NextResponse } from "next/server";
import { getActionsForScene, getSceneById, getSourcesForScene } from "@/lib/scenes";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scene = getSceneById(id);
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  return NextResponse.json({
    scene,
    actions: getActionsForScene(scene),
    sources: getSourcesForScene(scene),
  });
}
