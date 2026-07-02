import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ownerRoot = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/livo-sso", () => ({
  readLivoSession: () => ({ livoUserId: "user-1", email: "user@example.com" }),
  cwdBelongsToLivoUser: (cwd: string, userId: string) => cwd === join(ownerRoot.value, "users", userId) || cwd.includes(`/users/${userId}/`),
  filterLivoOwnedResourcesForRequest: <T extends { cwd?: string }>(_req: Request, resources: T[]) =>
    resources.filter((resource) => resource.cwd === join(ownerRoot.value, "users", "user-1") || resource.cwd?.includes("/users/user-1/")),
  filterLivoOwnedCwdsForRequest: (_req: Request, cwds: string[]) =>
    cwds.filter((cwd) => cwd === join(ownerRoot.value, "users", "user-1") || cwd.includes("/users/user-1/")),
  livoUserWorkspaceRoot: (userId: string) => join(ownerRoot.value, "users", userId),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    requireApiAuth: () => ({ kind: "loopback" }),
  };
});

vi.mock("@/lib/local-request-guard", () => ({
  rejectUnsafeMutation: () => null,
}));

vi.mock("@/lib/session-reader", () => ({
  listAllSessions: async () => [
    {
      id: "owned",
      cwd: "/data/pi-agent/workspaces/livo/users/user-1/default",
      path: "p1",
      created: "",
      modified: "",
      messageCount: 1,
      firstMessage: "owned",
    },
    {
      id: "other",
      cwd: "/data/pi-agent/workspaces/livo/users/user-2/default",
      path: "p2",
      created: "",
      modified: "",
      messageCount: 1,
      firstMessage: "other",
    },
  ],
  listProjectCwdsForPicker: async () => [
    "/data/pi-agent/workspaces/livo/users/user-1/default",
    "/data/pi-agent/workspaces/livo/users/user-2/default",
  ],
  resolveSessionPath: async (id: string) => id,
  invalidateSessionPathCache: () => undefined,
  buildSessionContext: () => ({ messages: [], entryIds: [] }),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  SessionManager: {
    open: (id: string) => ({
      getHeader: () => ({
        id,
        cwd: id === "owned"
          ? "/data/pi-agent/workspaces/livo/users/user-1/default"
          : "/data/pi-agent/workspaces/livo/users/user-2/default",
        timestamp: "2026-06-24T00:00:00.000Z",
      }),
      getEntries: () => [],
      getLeafId: () => null,
      getTree: () => [],
      getSessionName: () => id,
      appendSessionInfo: vi.fn(),
    }),
  },
}));

vi.mock("@/lib/rpc-manager", () => ({
  getRpcSession: () => null,
  startRpcSession: vi.fn(),
  getRunningRpcSessionIds: () => [],
}));

vi.mock("@/lib/scene-metadata", () => ({
  readProductSessionMetadataMap: () => ({}),
}));

describe("Livo session ownership", () => {
  beforeEach(() => {
    ownerRoot.value = mkdtempSync(join(tmpdir(), "pi-livo-owner-"));
  });

  afterEach(() => {
    rmSync(ownerRoot.value, { recursive: true, force: true });
    vi.resetModules();
  });

  it("filters sessions and picker cwd list by livo user workspace", async () => {
    const { GET } = await import("@/app/api/sessions/route");
    const res = await GET(new Request("https://pi.gottao.com/api/sessions"), undefined);
    const json = await res.json();

    expect(json.sessions.map((s: { id: string }) => s.id)).toEqual(["owned"]);
    expect(json.projectCwds).toEqual(["/data/pi-agent/workspaces/livo/users/user-1/default"]);
  });

  it("filters product history by livo user workspace", async () => {
    const { GET } = await import("@/app/api/history/route");
    const res = await GET(new Request("https://pi.gottao.com/api/history"), undefined);
    const json = await res.json();

    expect(json.history.map((item: { sessionId: string }) => item.sessionId)).toEqual(["owned"]);
    expect(JSON.stringify(json)).not.toContain("other");
    expect(JSON.stringify(json)).not.toContain("/users/user-2/");
  });

  it("hides another livo user's history item by id", async () => {
    const { GET } = await import("@/app/api/history/[id]/route");
    const res = await GET(
      new Request("https://pi.gottao.com/api/history/other"),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(404);
  });

  it("computes usage from the current livo user's sessions only", async () => {
    const { GET } = await import("@/app/api/usage/route");
    const res = await GET(new Request("https://pi.gottao.com/api/usage"), undefined);
    const json = await res.json();

    expect(json.usage.totalRuns).toBe(1);
  });

  it("rejects detail access outside livo user workspace", async () => {
    const { GET } = await import("@/app/api/sessions/[id]/route");
    const res = await GET(
      new Request("https://pi.gottao.com/api/sessions/other"),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(403);
  });

  it("rejects context access outside livo user workspace", async () => {
    const { GET } = await import("@/app/api/sessions/[id]/context/route");
    const res = await GET(
      new Request("https://pi.gottao.com/api/sessions/other/context"),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(403);
  });

  it("rejects agent commands outside livo user workspace", async () => {
    const { POST } = await import("@/app/api/agent/[id]/route");
    const res = await POST(
      new Request("https://pi.gottao.com/api/agent/other", {
        method: "POST",
        body: JSON.stringify({ type: "get_state" }),
      }),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(403);
  });

  it("rejects agent state reads outside livo user workspace", async () => {
    const { GET } = await import("@/app/api/agent/[id]/route");
    const res = await GET(
      new Request("https://pi.gottao.com/api/agent/other"),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(403);
  });

  it("rejects rename access outside livo user workspace", async () => {
    const { PATCH } = await import("@/app/api/sessions/[id]/route");
    const res = await PATCH(
      new Request("https://pi.gottao.com/api/sessions/other", {
        method: "PATCH",
        body: JSON.stringify({ name: "nope" }),
      }),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(403);
  });

  it("rejects delete access outside livo user workspace before touching files", async () => {
    const { DELETE } = await import("@/app/api/sessions/[id]/route");
    const res = await DELETE(
      new Request("https://pi.gottao.com/api/sessions/other", { method: "DELETE" }),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(res.status).toBe(403);
  });

  it("uses livo user workspace as default cwd", async () => {
    const { POST } = await import("@/app/api/default-cwd/route");
    const res = await POST(new Request("https://pi.gottao.com/api/default-cwd", { method: "POST" }));
    const json = await res.json();

    expect(json.cwd).toBe(join(ownerRoot.value, "users", "user-1"));
  });
});
