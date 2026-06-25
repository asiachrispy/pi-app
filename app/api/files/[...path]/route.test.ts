import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PI_WEB_PREFERENCES_FILENAME } from "@/lib/pi-web-preferences";

const roots = vi.hoisted(() => ({
  sessionCwd: "",
  agentDir: "",
}));

const livoSession = vi.hoisted(() => ({ value: null as null | { livoUserId: string } }));

vi.mock("@/lib/session-reader", () => ({
  listAllSessions: vi.fn(async () => [{ cwd: roots.sessionCwd }]),
}));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => roots.agentDir,
}));

vi.mock("@/lib/livo-sso", async () => {
  const actual = await vi.importActual<typeof import("@/lib/livo-sso")>("@/lib/livo-sso");
  return {
    ...actual,
    readLivoSession: () => livoSession.value,
  };
});

function pathSegments(filePath: string): string[] {
  return filePath.replace(/^\/+/, "").split("/");
}

function requestFor(filePath: string, type = "read"): NextRequest {
  return new NextRequest(`http://127.0.0.1:30142/api/files/${encodeURIComponent(filePath)}?type=${type}`, {
    headers: {
      host: "127.0.0.1:30142",
      origin: "http://127.0.0.1:30142",
    },
  });
}

describe("GET /api/files/[...path]", () => {
  const tmpDirs: string[] = [];

  function makeTempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
  }

  beforeEach(() => {
    roots.sessionCwd = makeTempDir("pi-files-cwd-");
    roots.agentDir = makeTempDir("pi-files-agent-");
    globalThis.__piAllowedRootsCache = undefined;
    livoSession.value = null;
  });

  afterEach(() => {
    globalThis.__piAllowedRootsCache = undefined;
    for (const dir of tmpDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
    delete process.env.PI_WEB_LIVO_WORKSPACE_ROOT;
    vi.clearAllMocks();
  });

  it("reads files inside an allowed session cwd", async () => {
    const { GET } = await import("./route");
    const filePath = join(roots.sessionCwd, "notes.txt");
    writeFileSync(filePath, "visible");

    const res = await GET(requestFor(filePath), {
      params: Promise.resolve({ path: pathSegments(filePath) }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ content: "visible", language: "text" });
  });

  it("allows the configured default workspace before it has any saved session", async () => {
    const workspace = makeTempDir("pi-files-default-ws-");
    writeFileSync(
      join(roots.agentDir, PI_WEB_PREFERENCES_FILENAME),
      JSON.stringify({ defaultWorkspaceCwd: workspace }),
    );

    const { GET } = await import("./route");
    const filePath = join(workspace, "readme.md");
    writeFileSync(filePath, "hello");

    const res = await GET(requestFor(filePath), {
      params: Promise.resolve({ path: pathSegments(filePath) }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ content: "hello" });
  });

  it("allows a recently opened workspace before it has any saved session", async () => {
    const workspace = makeTempDir("pi-files-recent-ws-");
    writeFileSync(
      join(roots.agentDir, PI_WEB_PREFERENCES_FILENAME),
      JSON.stringify({ recentWorkspaceCwds: [workspace] }),
    );

    const { GET } = await import("./route");
    const filePath = join(workspace, "note.md");
    writeFileSync(filePath, "recent");

    const res = await GET(requestFor(filePath), {
      params: Promise.resolve({ path: pathSegments(filePath) }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ content: "recent" });
  });

  it("rejects existing files outside allowed roots", async () => {
    const { GET } = await import("./route");
    const outsideRoot = makeTempDir("pi-files-outside-");
    const filePath = join(outsideRoot, "secret.txt");
    writeFileSync(filePath, "secret");

    const res = await GET(requestFor(filePath), {
      params: Promise.resolve({ path: pathSegments(filePath) }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Access denied" });
  });

  it("rejects watch requests outside allowed roots", async () => {
    const { GET } = await import("./route");
    const outsideRoot = makeTempDir("pi-files-outside-");
    const filePath = join(outsideRoot, "secret.txt");
    writeFileSync(filePath, "secret");

    const res = await GET(requestFor(filePath, "watch"), {
      params: Promise.resolve({ path: pathSegments(filePath) }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Access denied" });
  });

  it.skipIf(process.platform === "win32")("rejects symlinks that point outside allowed roots", async () => {
    const { GET } = await import("./route");
    const outsideRoot = makeTempDir("pi-files-outside-");
    const outsideFile = join(outsideRoot, "secret.txt");
    const symlinkPath = join(roots.sessionCwd, "linked-secret.txt");
    writeFileSync(outsideFile, "secret");
    symlinkSync(outsideFile, symlinkPath);

    const res = await GET(requestFor(symlinkPath), {
      params: Promise.resolve({ path: pathSegments(symlinkPath) }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Access denied" });
  });

  it("limits livo sso file access to the current user's workspace root", async () => {
    process.env.PI_WEB_LIVO_WORKSPACE_ROOT = makeTempDir("pi-files-livo-root-");
    livoSession.value = { livoUserId: "user-1" };
    const owned = join(process.env.PI_WEB_LIVO_WORKSPACE_ROOT, "users", "user-1", "note.txt");
    const other = join(process.env.PI_WEB_LIVO_WORKSPACE_ROOT, "users", "user-2", "secret.txt");
    roots.sessionCwd = join(process.env.PI_WEB_LIVO_WORKSPACE_ROOT, "users", "user-1");
    mkdirSync(roots.sessionCwd, { recursive: true });
    mkdirSync(join(process.env.PI_WEB_LIVO_WORKSPACE_ROOT, "users", "user-2"), { recursive: true });
    writeFileSync(owned, "owned");
    writeFileSync(other, "secret");

    const { GET } = await import("./route");
    const ok = await GET(requestFor(owned), {
      params: Promise.resolve({ path: pathSegments(owned) }),
    });
    const blocked = await GET(requestFor(other), {
      params: Promise.resolve({ path: pathSegments(other) }),
    });

    expect(ok.status).toBe(200);
    expect(blocked.status).toBe(403);
  });
});
