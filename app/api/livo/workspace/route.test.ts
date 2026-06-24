import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: () => null,
}));

function postWorkspace(body: unknown): Request {
  return new Request("http://127.0.0.1:30142/api/livo/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/livo/workspace", () => {
  const tmpDirs: string[] = [];
  let prevRoot: string | undefined;

  beforeEach(() => {
    prevRoot = process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    const root = mkdtempSync(join(tmpdir(), "pi-livo-root-"));
    tmpDirs.push(root);
    process.env.PI_WEB_LIVO_WORKSPACE_ROOT = root;
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    else process.env.PI_WEB_LIVO_WORKSPACE_ROOT = prevRoot;
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    globalThis.__piAllowedRootsCache = undefined;
    vi.clearAllMocks();
  });

  it("creates a meeting workspace under the configured Livo root", async () => {
    const { POST } = await import("./route");
    const res = await POST(postWorkspace({ userId: "user-42", meetingId: "meeting_123" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true });
    expect(json.cwd).toContain("/users/user-42/meetings/meeting_123");
    expect(existsSync(json.cwd)).toBe(true);
    expect(globalThis.__piAllowedRootsCache).toBeUndefined();
  });

  it("rejects path traversal input", async () => {
    const { POST } = await import("./route");
    const res = await POST(postWorkspace({ userId: "../user", meetingId: "meeting" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid userId" });
  });
});
