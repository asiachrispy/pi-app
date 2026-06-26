import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { startRpcSession } from "@/lib/rpc-manager";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { notifyLivoPiStatus } from "@/lib/livo-status-callback";
import type { LivoTodoStatusItem } from "@/lib/livo-status-callback";
import { readLivoSession, realCwdBelongsToLivoUser } from "@/lib/livo-sso";
import { runWithTenant } from "@/lib/livo/tenant-context";
import { tenantContextForUserId } from "@/lib/livo/tenant-gate";

// POST /api/agent/new  body: { cwd: string; type: string; message: string; ... }
// Spawns a brand-new pi session and immediately sends the first command.
// Returns { sessionId, data } where sessionId is pi's real session id.
export async function POST(req: Request) {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  try {
    const body = await req.json() as { cwd?: string; [key: string]: unknown };
    const { cwd, livoUserId, livoMeetingId, livoTodos, sessionName, ...command } = body;

    if (!cwd || typeof cwd !== "string") {
      return NextResponse.json({ error: "cwd is required" }, { status: 400 });
    }
    if (!existsSync(cwd)) {
      return NextResponse.json({ error: `Directory does not exist: ${cwd}` }, { status: 400 });
    }
    const livoOwner = typeof livoUserId === "string" && livoUserId.trim()
      ? livoUserId
      : readLivoSession(req)?.livoUserId;
    if (livoOwner && !realCwdBelongsToLivoUser(cwd, livoOwner)) {
      return NextResponse.json({ error: "cwd is outside current Livo workspace" }, { status: 403 });
    }

    // 方案二关键：Livo 新建 session 必须在租户上下文内执行，否则 startRpcSession 里的
    // currentAgentDir/currentSessionDir 会回退全局，新 session 落到全局目录。
    // 本路径是 server-to-server（租户身份来自 body.livoUserId 而非 cookie），
    // 故用 livoOwner 显式建立上下文；非 Livo（loopback）则直接执行走全局。
    const runCore = () => createSessionAndDispatch({
      cwd, command, livoUserId, livoMeetingId, livoTodos, sessionName,
    });
    const payload = livoOwner
      ? await runWithTenant(tenantContextForUserId(livoOwner), runCore)
      : await runCore();

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function createSessionAndDispatch(args: {
  cwd: string;
  command: Record<string, unknown>;
  livoUserId: unknown;
  livoMeetingId: unknown;
  livoTodos: unknown;
  sessionName: unknown;
}): Promise<{ success: true; sessionId: string; data: unknown }> {
  const { cwd, command, livoUserId, livoMeetingId, livoTodos, sessionName } = args;

  // Use a one-time key so startRpcSession's lock doesn't conflict with real session ids
  const { provider, modelId, toolNames, thinkingLevel, ...promptCommand } = command as { provider?: string; modelId?: string; toolNames?: string[]; thinkingLevel?: string; [key: string]: unknown };

  const tempKey = `__new__${crypto.randomUUID()}`;
  const { session, realSessionId } = await startRpcSession(tempKey, "", cwd, toolNames);
  if (typeof sessionName === "string" && sessionName.trim()) {
    session.inner.appendSessionInfo?.(sessionName.trim());
  }

  // Keep the files-route allowed-roots cache (see app/api/files/[...path]/route.ts)
  // in sync so the new cwd is immediately readable via /api/files. Without this,
  // a file request under a brand-new cwd would 403 for up to the cache TTL.
  globalThis.__piAllowedRootsCache?.roots.add(cwd);

  // Apply pre-selected model before sending the prompt
  if (provider && modelId) {
    await session.send({ type: "set_model", provider, modelId });
  }

  // Apply pre-selected thinking level before sending the prompt
  if (thinkingLevel) {
    await session.send({ type: "set_thinking_level", level: thinkingLevel });
  }

  let result: unknown;
  try {
    result = await session.send(promptCommand);
  } catch (error) {
    await notifyLivoPiStatus({
      userId: livoUserId,
      meetingId: livoMeetingId,
      piSessionId: realSessionId,
      status: "failed",
      message: String(error),
      items: livoTodoItems(livoTodos, "failed", String(error)),
    });
    throw error;
  }

  await notifyLivoPiStatus({
    userId: livoUserId,
    meetingId: livoMeetingId,
    piSessionId: realSessionId,
    status: "running",
    items: livoTodoItems(livoTodos, "running"),
  });

  return { success: true, sessionId: realSessionId, data: result };
}

function livoTodoItems(value: unknown, status: "running" | "failed", message?: string): LivoTodoStatusItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: LivoTodoStatusItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const todo = item as { todoId?: unknown; title?: unknown };
    if (typeof todo.todoId !== "string" || !todo.todoId.trim()) continue;
    items.push({
      todoId: todo.todoId,
      title: typeof todo.title === "string" ? todo.title : undefined,
      status,
      message,
    });
  }
  return items;
}
