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
      session: { send: vi.fn(async () => null) },
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
});
