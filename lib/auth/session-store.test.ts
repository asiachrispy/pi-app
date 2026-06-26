import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLivoSessionStore,
  FileLivoSessionStore,
  getLivoSessionStore,
  initLivoSessionStore,
  livoSessionStorePath,
  resetLivoSessionStoreForTests,
  resolveSessionStoreKind,
  setRedisSessionBackendFactoryForTests,
} from "./session-store";
import { createRedisLivoSessionStore, InMemoryRedisSessionBackend } from "./redis-livo-session-store";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

const sampleRecord = {
  livoUserId: "user-1",
  storeKey: "sid-1",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("session-store", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-session-store-"));
    resetLivoSessionStoreForTests();
    vi.stubEnv("PI_SESSION_STORE_KIND", "file");
    vi.stubEnv("PI_SESSION_STORE_URL", "");
    vi.stubEnv("PI_SESSION_STORE_DUAL_WRITE", "");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    resetLivoSessionStoreForTests();
    vi.unstubAllEnvs();
  });

  it("defaults to file kind", () => {
    vi.stubEnv("PI_SESSION_STORE_KIND", "");
    expect(resolveSessionStoreKind()).toBe("file");
  });

  it("persists livo sessions to livo-sessions.json", () => {
    const store = createLivoSessionStore();
    store.set("sid-1", sampleRecord);

    expect(store.get("sid-1")?.livoUserId).toBe("user-1");
    const raw = readFileSync(livoSessionStorePath(agentDir.value), "utf8");
    expect(JSON.parse(raw)).toMatchObject({
      "sid-1": { livoUserId: "user-1" },
    });
  });

  it("deletes sessions by key", () => {
    const store = new FileLivoSessionStore(livoSessionStorePath(agentDir.value));
    store.set("sid-1", sampleRecord);
    store.delete("sid-1");
    expect(store.get("sid-1")).toBeUndefined();
  });

  it("dual-writes to file and redis while reading file (9b)", async () => {
    const backend = new InMemoryRedisSessionBackend();
    vi.stubEnv("PI_SESSION_STORE_KIND", "file");
    vi.stubEnv("PI_SESSION_STORE_DUAL_WRITE", "1");
    vi.stubEnv("PI_SESSION_STORE_URL", "redis://127.0.0.1:6379/3");

    const { createRedisLivoSessionStore } = await import("./redis-livo-session-store");
    const redisStore = createRedisLivoSessionStore(
      {
        host: "127.0.0.1",
        port: 6379,
        database: 3,
        livoKeyPrefix: "pi:session:livo:",
      },
      backend,
    );

    const fileStore = new FileLivoSessionStore(livoSessionStorePath(agentDir.value));
    const dual = {
      get: (key: string) => fileStore.get(key),
      set: (key: string, record: typeof sampleRecord) => {
        fileStore.set(key, record);
        redisStore.set(key, record);
      },
      delete: (key: string) => {
        fileStore.delete(key);
        redisStore.delete(key);
      },
      readAll: () => fileStore.readAll(),
    };

    dual.set("sid-dual", sampleRecord);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(dual.get("sid-dual")?.livoUserId).toBe("user-1");
    expect(readFileSync(livoSessionStorePath(agentDir.value), "utf8")).toContain("sid-dual");
    await redisStore.warmFromRedis();
    expect(redisStore.get("sid-dual")?.livoUserId).toBe("user-1");
    await redisStore.disposeForTests();
  });

  it("reads from redis after warm and imports missing file sessions (9c)", async () => {
    const backend = new InMemoryRedisSessionBackend();
    setRedisSessionBackendFactoryForTests(() => backend);
    vi.stubEnv("PI_SESSION_STORE_KIND", "redis");
    vi.stubEnv("PI_SESSION_STORE_DUAL_WRITE", "1");
    vi.stubEnv("PI_SESSION_STORE_URL", "redis://127.0.0.1:6379/3");

    mkdirSync(join(agentDir.value, "auth"), { recursive: true });
    const filePath = livoSessionStorePath(agentDir.value);
    const fileOnly = {
      ...sampleRecord,
      storeKey: "sid-file",
      livoUserId: "file-user",
    };
    const { writeFileSync } = await import("node:fs");
    writeFileSync(filePath, JSON.stringify({ "sid-file": fileOnly }, null, 2));

    await initLivoSessionStore();
    const store = getLivoSessionStore();

    expect(store.get("sid-file")?.livoUserId).toBe("file-user");
    expect(readFileSync(filePath, "utf8")).toContain("sid-file");

    const redisStore = createRedisLivoSessionStore(
      {
        host: "127.0.0.1",
        port: 6379,
        database: 3,
        livoKeyPrefix: "pi:session:livo:",
      },
      backend,
    );
    await redisStore.warmFromRedis();
    expect(redisStore.get("sid-file")?.livoUserId).toBe("file-user");
    await redisStore.disposeForTests();
  });

  it("requires redis url when kind is redis", () => {
    vi.stubEnv("PI_SESSION_STORE_KIND", "redis");
    vi.stubEnv("PI_SESSION_STORE_URL", "");
    expect(() => createLivoSessionStore()).toThrow(/PI_SESSION_STORE_URL/);
  });
});
