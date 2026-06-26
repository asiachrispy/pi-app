import { NextResponse } from "next/server";
import { resolveSessionPath } from "@/lib/session-reader";
import { startRpcSession, getRpcSession } from "@/lib/rpc-manager";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { rejectUnsafeMutation } from "@/lib/local-request-guard";
import { isAuthError, requireApiAuth } from "@/lib/api-auth";
import { hasLivoSession, rejectLivoCwdOutsideWorkspace } from "@/lib/livo-session-guard";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { withTenant } from "@/lib/livo/with-tenant";

async function sendToAgentSession(
  req: Request,
  id: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const filePath = await resolveSessionPath(id, currentAgentDir());
  if (!filePath) {
    const err = new Error("Session not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }

  const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? process.cwd();
  const rejectedByOwner = rejectLivoCwdOutsideWorkspace(req, cwd);
  if (rejectedByOwner) {
    const err = new Error("Session is outside current Livo workspace");
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  const existing = getRpcSession(id);
  if (existing?.isAlive()) {
    try {
      return await existing.send(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (body.type === "set_model" && message.includes("Model not found")) {
        existing.destroy();
      } else {
        throw error;
      }
    }
  }

  const { session } = await startRpcSession(id, filePath, cwd);
  return session.send(body);
}

// POST /api/agent/[id] - Send a command to an existing session
export const POST = withTenant(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const rejected = rejectUnsafeMutation(req);
  if (rejected) return rejected;

  const { id } = await params;

  try {
    const body = await req.json() as { type: string; [key: string]: unknown };
    const result = await sendToAgentSession(req, id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    return NextResponse.json({ error: String(error) }, { status });
  }
});

// GET /api/agent/[id] - Get current agent state
export const GET = withTenant(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = requireApiAuth(req);
  if (isAuthError(auth)) return auth;

  const { id } = await params;

  try {
    const filePath = await resolveSessionPath(id, currentAgentDir());
    if (!filePath && hasLivoSession(req)) {
      return NextResponse.json({ running: false }, { status: 404 });
    }
    if (filePath) {
      const cwd = SessionManager.open(filePath).getHeader()?.cwd ?? process.cwd();
      const rejectedByOwner = rejectLivoCwdOutsideWorkspace(req, cwd);
      if (rejectedByOwner) return rejectedByOwner;
    }
    const session = getRpcSession(id);
    if (!session || !session.isAlive()) {
      return NextResponse.json({ running: false });
    }

    const state = await session.send({ type: "get_state" });
    return NextResponse.json({ running: true, state });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
});
