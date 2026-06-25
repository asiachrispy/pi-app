import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPiWebPreferences } from "@/lib/pi-web-preferences";

const livoSession = vi.hoisted(() => ({ value: null as null | { livoUserId: string } }));

vi.mock("@/lib/local-request-guard", () => ({
  rejectUnsafeMutation: () => null,
}));

vi.mock("@/lib/livo-sso", async () => {
  const actual = await vi.importActual<typeof import("@/lib/livo-sso")>("@/lib/livo-sso");
  return {
    ...actual,
    readLivoSession: () => livoSession.value,
  };
});

function postCwd(cwd: string): Request {
  return new Request("http://127.0.0.1:30142/api/cwd/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
}

describe("POST /api/cwd/validate", () => {
  const tmpDirs: string[] = [];
  let prevAgentDir: string | undefined;
  let prevLivoRoot: string | undefined;

  beforeEach(() => {
    prevAgentDir = process.env.PI_CODING_AGENT_DIR;
    prevLivoRoot = process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    const agentDir = mkdtempSync(join(tmpdir(), "pi-validate-agent-"));
    tmpDirs.push(agentDir);
    process.env.PI_CODING_AGENT_DIR = agentDir;
  });

  afterEach(() => {
    if (prevAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = prevAgentDir;
    if (prevLivoRoot === undefined) delete process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    else process.env.PI_WEB_LIVO_WORKSPACE_ROOT = prevLivoRoot;
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    globalThis.__piAllowedRootsCache = undefined;
    livoSession.value = null;
    vi.clearAllMocks();
  });

  it("records a validated workspace and invalidates the allowed-roots cache", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "pi-validate-ws-"));
    tmpDirs.push(workspace);
    globalThis.__piAllowedRootsCache = { roots: new Set(["/stale"]), expiresAt: Date.now() + 10_000 };

    const { POST } = await import("./route");
    const res = await POST(postCwd(workspace));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, cwd: workspace });
    expect(loadPiWebPreferences().recentWorkspaceCwds).toContain(workspace);
    expect(globalThis.__piAllowedRootsCache).toBeUndefined();
  });

  it("rejects a path that does not exist", async () => {
    const { POST } = await import("./route");
    const res = await POST(postCwd(join(tmpdir(), "pi-validate-missing-zzz")));

    expect(res.status).toBe(400);
  });

  it("resolves livo custom paths from the user root and rejects outside paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "pi-livo-root-"));
    tmpDirs.push(root);
    process.env.PI_WEB_LIVO_WORKSPACE_ROOT = root;
    const meetingDir = join(root, "users", "user-1", "meetings", "m1");
    mkdirSync(meetingDir, { recursive: true });
    livoSession.value = { livoUserId: "user-1" };

    const { POST } = await import("./route");
    const ok = await POST(postCwd("meetings/m1"));
    const outside = await POST(postCwd(join(root, "users", "user-2")));

    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ cwd: meetingDir });
    expect(outside.status).toBe(403);
  });
});
