import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resourceLoaderMock = vi.hoisted(() => ({
  createAgentResourceLoader: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    requireApiAuth: () => ({ kind: "loopback" }),
  };
});

vi.mock("@/lib/livo-session-guard", () => ({
  rejectLivoCwdOutsideWorkspace: () => null,
}));

vi.mock("@/lib/livo/tenant-gate", () => ({
  currentAgentDir: () => "/tenant/.pi-agent",
}));

vi.mock("@/lib/livo/with-tenant", () => ({
  withTenant: (handler: unknown) => handler,
}));

vi.mock("@/lib/agent-resource-loader", () => ({
  createAgentResourceLoader: resourceLoaderMock.createAgentResourceLoader,
}));

describe("GET /api/slash-commands", () => {
  const tmpDirs: string[] = [];

  beforeEach(() => {
    resourceLoaderMock.createAgentResourceLoader.mockReset();
    resourceLoaderMock.createAgentResourceLoader.mockResolvedValue({
      getSkills: () => ({ skills: [{ name: "livo-todo", description: "Run Livo todo" }] }),
    });
  });

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("returns workspace skill slash commands before a session exists", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "pi-slash-commands-"));
    tmpDirs.push(cwd);
    mkdirSync(cwd, { recursive: true });
    const { GET } = await import("./route");

    const res = await GET(new Request(`https://pi.gottao.com/api/slash-commands?cwd=${encodeURIComponent(cwd)}`), undefined);
    const body = await res.json() as { commands: Array<{ name: string }> };

    expect(res.status).toBe(200);
    expect(resourceLoaderMock.createAgentResourceLoader).toHaveBeenCalledWith(cwd, "/tenant/.pi-agent");
    expect(body.commands.map((cmd) => cmd.name)).toEqual(["skill:livo-todo"]);
  });
});
