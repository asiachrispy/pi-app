import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  startRpcSession: vi.fn(),
}));

vi.mock("@/lib/local-request-guard", () => ({
  rejectUnsafeMutation: () => null,
}));

vi.mock("@/lib/rpc-manager", () => ({
  startRpcSession: rpc.startRpcSession,
}));

vi.mock("@/lib/livo-status-callback", () => ({
  notifyLivoPiStatus: vi.fn(async () => undefined),
}));

function postAgent(body: unknown): Request {
  return new Request("https://pi.gottao.com/api/agent/new", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agent/new", () => {
  const tmpDirs: string[] = [];
  let prevLivoRoot: string | undefined;

  beforeEach(() => {
    prevLivoRoot = process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    const root = mkdtempSync(join(tmpdir(), "pi-agent-new-livo-"));
    tmpDirs.push(root);
    process.env.PI_WEB_LIVO_WORKSPACE_ROOT = root;
    rpc.startRpcSession.mockReset();
    rpc.startRpcSession.mockResolvedValue({
      realSessionId: "session-1",
      session: { send: vi.fn(async () => null), inner: { appendSessionInfo: vi.fn() } },
    });
  });

  afterEach(() => {
    if (prevLivoRoot === undefined) delete process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    else process.env.PI_WEB_LIVO_WORKSPACE_ROOT = prevLivoRoot;
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("rejects livo server dispatch outside the submitted user's workspace", async () => {
    const { POST } = await import("./route");
    const outside = mkdtempSync(join(tmpdir(), "pi-agent-new-outside-"));
    tmpDirs.push(outside);

    const res = await POST(postAgent({
      cwd: outside,
      type: "prompt",
      message: "hello",
      livoUserId: "user-1",
    }));

    expect(res.status).toBe(403);
    expect(rpc.startRpcSession).not.toHaveBeenCalled();
  });

  it("allows livo server dispatch inside the submitted user's workspace", async () => {
    const { POST } = await import("./route");
    const cwd = join(process.env.PI_WEB_LIVO_WORKSPACE_ROOT!, "users", "user-1");
    mkdirSync(cwd, { recursive: true });

    const res = await POST(postAgent({
      cwd,
      type: "prompt",
      message: "hello",
      livoUserId: "user-1",
    }));

    expect(res.status).toBe(200);
    expect(rpc.startRpcSession).toHaveBeenCalledWith(expect.any(String), "", cwd, undefined);
  });

  it("sets submitted Livo session name before dispatching the prompt", async () => {
    const { POST } = await import("./route");
    const cwd = join(process.env.PI_WEB_LIVO_WORKSPACE_ROOT!, "users", "user-1");
    mkdirSync(cwd, { recursive: true });

    const res = await POST(postAgent({
      cwd,
      type: "prompt",
      message: "hello",
      livoUserId: "user-1",
      sessionName: "fileId_1_跟进客户",
    }));

    const session = (await rpc.startRpcSession.mock.results[0].value).session;
    expect(res.status).toBe(200);
    expect(session.inner.appendSessionInfo).toHaveBeenCalledWith("fileId_1_跟进客户");
  });

  it("returns 200 for type:'ensure_session' without forwarding the command to session.send", async () => {
    // Regression: client uses type:"ensure_session" to claim a sessionId
    // before sending the actual prompt in a follow-up POST /api/agent/[id].
    // The route must NOT forward that placeholder type to session.send, or
    // the real RPC manager throws "Unsupported command: ensure_session"
    // → server returns 500 → client throws HTTP 500 → "页面闪一下"。
    const { POST } = await import("./route");
    const send = vi.fn(async (command: Record<string, unknown>) => {
      // Mirror real RPC behavior: unknown types throw.
      if (command.type === "ensure_session") {
        throw new Error("Unsupported command: ensure_session");
      }
      return null;
    });
    rpc.startRpcSession.mockResolvedValueOnce({
      realSessionId: "session-ensure",
      session: { send, inner: { appendSessionInfo: vi.fn() } },
    });

    const res = await POST(postAgent({
      cwd: "/tmp",
      type: "ensure_session",
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; sessionId: string };
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe("session-ensure");
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "ensure_session" }));
  });

  it("forwards type:'prompt' (with type in payload) to session.send", async () => {
    // Regression guard: ensure_session short-circuit must NOT strip `type`
    // from the prompt payload. The RPC manager dispatches on `command.type`,
    // so a prompt body without type hits the default branch and throws.
    const { POST } = await import("./route");
    const send = vi.fn(async () => null);
    rpc.startRpcSession.mockResolvedValueOnce({
      realSessionId: "session-prompt",
      session: { send, inner: { appendSessionInfo: vi.fn() } },
    });

    const res = await POST(postAgent({
      cwd: "/tmp",
      type: "prompt",
      message: "hello",
    }));

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "prompt", message: "hello" }));
  });
});
