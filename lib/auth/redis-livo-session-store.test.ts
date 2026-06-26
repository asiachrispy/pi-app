import { afterEach, describe, expect, it } from "vitest";
import {
  createRedisLivoSessionStore,
  InMemoryRedisSessionBackend,
} from "./redis-livo-session-store";
import type { LivoSessionStore } from "./session-store";

const config = {
  host: "127.0.0.1",
  port: 6379,
  database: 3,
  livoKeyPrefix: "pi:session:livo:",
};

const sampleRecord = {
  livoUserId: "user-redis",
  storeKey: "sid-redis",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("RedisLivoSessionStore", () => {
  let backend: InMemoryRedisSessionBackend;
  let store: ReturnType<typeof createRedisLivoSessionStore>;

  afterEach(async () => {
    await store.disposeForTests();
  });

  it("serves reads from cache and persists to backend", async () => {
    backend = new InMemoryRedisSessionBackend();
    store = createRedisLivoSessionStore(config, backend);
    store.set("sid-redis", sampleRecord);

    expect(store.get("sid-redis")?.livoUserId).toBe("user-redis");
    await new Promise((resolve) => setTimeout(resolve, 10));
    await store.warmFromRedis();
    expect(store.get("sid-redis")?.livoUserId).toBe("user-redis");
  });

  it("imports missing sessions from file store", async () => {
    backend = new InMemoryRedisSessionBackend();
    store = createRedisLivoSessionStore(config, backend);
    const fileStore: LivoSessionStore = {
      readAll: () => ({ "sid-import": sampleRecord }),
      get: () => undefined,
      set: () => {},
      delete: () => {},
    };

    const imported = await store.importMissingFrom(fileStore);
    expect(imported).toBe(1);
    expect(store.get("sid-import")?.livoUserId).toBe("user-redis");
  });
});
