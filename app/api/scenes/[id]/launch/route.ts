import { existsSync } from "fs";
import { NextResponse } from "next/server";
import { startRpcSession } from "@/lib/rpc-manager";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { buildSceneLaunchMessage, getSceneById, titleFromMessage } from "@/lib/scenes";
import { upsertProductSessionMetadata } from "@/lib/scene-metadata";

interface LaunchBody {
  cwd?: string;
  message?: string;
  images?: { type: "image"; data: string; mimeType: string }[];
  provider?: string;
  modelId?: string;
  toolNames?: string[];
  thinkingLevel?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  const { id } = await params;
  const scene = getSceneById(id);
  if (!scene) {
    return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  }

  try {
    const body = await req.json() as LaunchBody;
    const { cwd, message, images, provider, modelId, toolNames, thinkingLevel } = body;

    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    if (!existsSync(cwd)) {
      return NextResponse.json({ error: `Directory does not exist: ${cwd}` }, { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const tempKey = `__scene__${scene.id}__${Date.now()}`;
    const { session, realSessionId } = await startRpcSession(tempKey, "", cwd, toolNames);

    globalThis.__piAllowedRootsCache?.roots.add(cwd);

    if (provider && modelId) {
      await session.send({ type: "set_model", provider, modelId });
    }
    if (thinkingLevel) {
      await session.send({ type: "set_thinking_level", level: thinkingLevel });
    }

    const launchMessage = buildSceneLaunchMessage(scene, message);
    const result = await session.send({
      type: "prompt",
      message: launchMessage,
      ...(images?.length ? { images } : {}),
    });
    const now = new Date().toISOString();
    upsertProductSessionMetadata(realSessionId, {
      sceneId: scene.id,
      title: titleFromMessage(message, scene.name),
      status: "active",
      lastResultSummary: message.trim(),
      startedAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      sessionId: realSessionId,
      sceneId: scene.id,
      data: result,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
