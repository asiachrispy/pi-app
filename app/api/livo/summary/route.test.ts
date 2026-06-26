import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
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

function getSummary(query: string): Request {
  return new Request(`http://127.0.0.1:30142/api/livo/summary?${query}`, {
    method: "GET",
  });
}

describe("GET /api/livo/summary", () => {
  const tmpDirs: string[] = [];
  let prevRoot: string | undefined;
  let prevIntegrationEnabled: string | undefined;
  let root: string;

  beforeEach(() => {
    prevRoot = process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    prevIntegrationEnabled = process.env.PI_LIVO_INTEGRATION_ENABLED;
    root = mkdtempSync(join(tmpdir(), "pi-livo-summary-"));
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
    vi.clearAllMocks();
  });

  it("returns exists:false when summary.md is absent", async () => {
    const { GET } = await import("./route");
    const res = await GET(getSummary("userId=user-1&meeting=fileId_1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: false, summary: "" });
  });

  it("returns the summary content when present", async () => {
    const outputs = join(root, "users", "user-1", "meetings", "fileId_1", "outputs");
    mkdirSync(outputs, { recursive: true });
    writeFileSync(join(outputs, "summary.md"), "# 执行结果\n\n## 总览\n- 任务总数：1\n");

    const { GET } = await import("./route");
    const res = await GET(getSummary("userId=user-1&meeting=fileId_1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exists).toBe(true);
    expect(json.summary).toContain("执行结果");
    expect(json.summary).toContain("任务总数");
  });

  it("rejects invalid userId / meeting segments", async () => {
    const { GET } = await import("./route");
    const bad = await GET(getSummary("userId=../etc&meeting=fileId_1"));
    expect(bad.status).toBe(400);
    const badMeeting = await GET(getSummary("userId=user-1&meeting=..%2F..%2Fetc"));
    expect(badMeeting.status).toBe(400);
  });
});
