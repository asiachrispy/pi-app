import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    requireApiAuth: () => ({ kind: "loopback" }),
  };
});

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
  let prevIntegrationEnabled: string | undefined;

  beforeEach(() => {
    prevRoot = process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    prevIntegrationEnabled = process.env.PI_LIVO_INTEGRATION_ENABLED;
    const root = mkdtempSync(join(tmpdir(), "pi-livo-root-"));
    tmpDirs.push(root);
    process.env.PI_LIVO_INTEGRATION_ENABLED = "1";
    process.env.PI_WEB_LIVO_WORKSPACE_ROOT = root;
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    else process.env.PI_WEB_LIVO_WORKSPACE_ROOT = prevRoot;
    if (prevIntegrationEnabled === undefined) delete process.env.PI_LIVO_INTEGRATION_ENABLED;
    else process.env.PI_LIVO_INTEGRATION_ENABLED = prevIntegrationEnabled;
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    globalThis.__piAllowedRootsCache = undefined;
    vi.clearAllMocks();
  });

  it("creates one user workspace and a meeting folder under it", async () => {
    const { POST } = await import("./route");
    const res = await POST(postWorkspace({
      userId: "user-42",
      meetingId: "meeting_123",
      summary: "会议摘要",
      todos: "- 跟进客户",
      transcript: "完整转录",
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      workspaceId: "livo:user-42",
      meetingId: "meeting_123",
    });
    expect(json.cwd).toContain("/users/user-42");
    expect(json.cwd).not.toContain("/meetings/meeting_123");
    expect(json.meetingPath).toContain("/users/user-42/meetings/meeting_123");
    expect(existsSync(json.cwd)).toBe(true);
    const agents = readFileSync(join(json.cwd, "AGENTS.md"), "utf8");
    expect(agents).toContain("Livo Meeting Execution Rules");
    expect(agents).toContain("summary.md");
    expect(agents).toContain("不自动发送邮件");
    expect(readdirSync(json.cwd)).not.toContain("agents.md");
    expect(existsSync(json.meetingPath)).toBe(true);
    expect(existsSync(join(json.meetingPath, "inputs"))).toBe(true);
    expect(readFileSync(join(json.meetingPath, "inputs", "meeting-brief.md"), "utf8")).toContain("会议摘要");
    expect(readFileSync(join(json.meetingPath, "inputs", "meeting-brief.md"), "utf8")).toContain("- 跟进客户");
    expect(readFileSync(join(json.meetingPath, "inputs", "transcript.txt"), "utf8")).toBe("完整转录");
    expect(existsSync(join(json.meetingPath, "inputs", "meeting-summary.md"))).toBe(false);
    expect(existsSync(join(json.meetingPath, "inputs", "todos.md"))).toBe(false);
    expect(existsSync(join(json.meetingPath, "inputs", "transcript.md"))).toBe(false);
    expect(json.workspaceUrl).toContain("/app/?workspace=livo%3Auser-42&meeting=meeting_123");
    expect(globalThis.__piAllowedRootsCache).toBeUndefined();
  });

  it("rejects path traversal input", async () => {
    const { POST } = await import("./route");
    const res = await POST(postWorkspace({ userId: "../user", meetingId: "meeting" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid userId" });
  });

  it("does not overwrite an existing AGENTS.md", async () => {
    const { POST } = await import("./route");
    const first = await POST(postWorkspace({ userId: "user-42", meetingId: "meeting_123" }));
    const firstJson = await first.json();
    writeFileSync(join(firstJson.cwd, "AGENTS.md"), "custom user rules");

    const second = await POST(postWorkspace({ userId: "user-42", meetingId: "meeting_456" }));

    expect(second.status).toBe(200);
    expect(readFileSync(join(firstJson.cwd, "AGENTS.md"), "utf8")).toBe("custom user rules");
  });
});
