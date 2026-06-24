import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ownerRoot = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/livo-sso", () => ({
  readLivoSession: () => ({ livoUserId: "user-1", email: "user@example.com" }),
  cwdBelongsToLivoUser: (cwd: string, userId: string) => cwd.includes(`/users/${userId}/`),
  livoUserWorkspaceRoot: (userId: string) => join(ownerRoot.value, "users", userId),
}));

vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: () => null,
}));

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
    const res = await GET(new Request("https://pi.gottao.com/api/sessions"));
    const json = await res.json();

    expect(json.sessions.map((s: { id: string }) => s.id)).toEqual(["owned"]);
    expect(json.projectCwds).toEqual(["/data/pi-agent/workspaces/livo/users/user-1/default"]);
  });

  it("rejects detail access outside livo user workspace", async () => {
    const { GET } = await import("@/app/api/sessions/[id]/route");
    const res = await GET(
      new Request("https://pi.gottao.com/api/sessions/other"),
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

    expect(json.cwd).toBe(join(ownerRoot.value, "users", "user-1", "default"));
  });
});
