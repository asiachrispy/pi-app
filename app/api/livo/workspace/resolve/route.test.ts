import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    requireApiAuth: () => ({ kind: "loopback" }),
  };
});

const livoSession = vi.hoisted(() => ({ value: null as null | { livoUserId: string } }));

vi.mock("@/lib/livo-sso", async () => {
  const actual = await vi.importActual<typeof import("@/lib/livo-sso")>("@/lib/livo-sso");
  return {
    ...actual,
    readLivoSession: () => livoSession.value,
  };
});

describe("GET /api/livo/workspace/resolve", () => {
  const tmpDirs: string[] = [];
  let prevRoot: string | undefined;
  let prevIntegrationEnabled: string | undefined;

  beforeEach(() => {
    prevRoot = process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    prevIntegrationEnabled = process.env.PI_LIVO_INTEGRATION_ENABLED;
    const root = mkdtempSync(join(tmpdir(), "pi-livo-resolve-"));
    tmpDirs.push(root);
    process.env.PI_LIVO_INTEGRATION_ENABLED = "1";
    process.env.PI_WEB_LIVO_WORKSPACE_ROOT = root;
    livoSession.value = { livoUserId: "user-42" };
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    else process.env.PI_WEB_LIVO_WORKSPACE_ROOT = prevRoot;
    if (prevIntegrationEnabled === undefined) delete process.env.PI_LIVO_INTEGRATION_ENABLED;
    else process.env.PI_LIVO_INTEGRATION_ENABLED = prevIntegrationEnabled;
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    livoSession.value = null;
    vi.clearAllMocks();
  });

  it("resolves the current user's Livo workspace to a user-level cwd", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/workspace/resolve?workspace=livo:user-42&meeting=meeting_123"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      workspaceId: "livo:user-42",
      meetingId: "meeting_123",
    });
    expect(json.cwd).toContain("/users/user-42");
    expect(json.cwd).not.toContain("/meetings/meeting_123");
    expect(json.meetingPath).toContain("/users/user-42/meetings/meeting_123");
    expect(existsSync(json.cwd)).toBe(true);
    expect(existsSync(json.meetingPath)).toBe(true);
  });

  it("rejects another user's workspace", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/workspace/resolve?workspace=livo:other"));

    expect(res.status).toBe(403);
  });
});
