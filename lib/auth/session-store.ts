import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@/lib/agent-dir";
import { createRedisLivoSessionStore, type RedisLivoSessionStore, type RedisSessionBackend } from "./redis-livo-session-store";
import {
  resolveRedisSessionStoreConfig,
  resolveSessionStoreDualWrite,
  type RedisSessionStoreConfig,
} from "./session-store-config";

/** Livo 登录后会话在 store 中的原始记录（与 livo-sessions.json 字段对齐）。 */
export interface LivoStoredSessionRecord {
  livoUserId: string;
  email?: string;
  name?: string;
  storeKey?: string;
  sidHash?: string;
  createdAt: string;
  expiresAt: string;
}

export type SessionStoreKind = "file" | "redis";

export interface LivoSessionStore {
  get(storeKey: string): LivoStoredSessionRecord | undefined;
  set(storeKey: string, record: LivoStoredSessionRecord): void;
  delete(storeKey: string): void;
  readAll(): Record<string, LivoStoredSessionRecord>;
}

export interface InitializableLivoSessionStore extends LivoSessionStore {
  initialize?(): Promise<void>;
}

export class FileLivoSessionStore implements LivoSessionStore {
  constructor(private readonly filePath: string) {}

  readAll(): Record<string, LivoStoredSessionRecord> {
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, LivoStoredSessionRecord>;
    } catch {
      return {};
    }
  }

  private writeAll(store: Record<string, LivoStoredSessionRecord>): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(store, null, 2));
  }

  get(storeKey: string): LivoStoredSessionRecord | undefined {
    return this.readAll()[storeKey];
  }

  set(storeKey: string, record: LivoStoredSessionRecord): void {
    const store = this.readAll();
    store[storeKey] = record;
    this.writeAll(store);
  }

  delete(storeKey: string): void {
    const store = this.readAll();
    delete store[storeKey];
    this.writeAll(store);
  }
}

class DualWriteLivoSessionStore implements InitializableLivoSessionStore {
  constructor(
    private readonly readStore: LivoSessionStore,
    private readonly writeStores: LivoSessionStore[],
    private readonly initializer?: () => Promise<void>,
  ) {}

  get(storeKey: string): LivoStoredSessionRecord | undefined {
    return this.readStore.get(storeKey);
  }

  set(storeKey: string, record: LivoStoredSessionRecord): void {
    for (const store of this.writeStores) {
      store.set(storeKey, record);
    }
  }

  delete(storeKey: string): void {
    for (const store of this.writeStores) {
      store.delete(storeKey);
    }
  }

  readAll(): Record<string, LivoStoredSessionRecord> {
    return this.readStore.readAll();
  }

  async initialize(): Promise<void> {
    if (this.initializer) {
      await this.initializer();
    }
  }
}

export function resolveSessionStoreKind(): SessionStoreKind {
  const kind = process.env.PI_SESSION_STORE_KIND?.trim().toLowerCase();
  return kind === "redis" ? "redis" : "file";
}

export function livoSessionStorePath(agentDir = getAgentDir()): string {
  return join(agentDir, "auth", "livo-sessions.json");
}

function buildRedisInitializer(
  redisStore: RedisLivoSessionStore,
  fileStore: FileLivoSessionStore,
  kind: SessionStoreKind,
): () => Promise<void> {
  return async () => {
    await redisStore.warmFromRedis();
    if (kind === "redis") {
      const imported = await redisStore.importMissingFrom(fileStore);
      if (imported > 0) {
        console.info(`[pi-app] Imported ${imported} Livo session(s) from file into Redis cache`);
      }
    }
  };
}

export function createLivoSessionStore(agentDir?: string): InitializableLivoSessionStore {
  const fileStore = new FileLivoSessionStore(livoSessionStorePath(agentDir));
  const kind = resolveSessionStoreKind();
  const dualWrite = resolveSessionStoreDualWrite();
  const redisConfig = resolveRedisSessionStoreConfig();

  if (kind === "redis" && !redisConfig) {
    throw new Error("PI_SESSION_STORE_URL is required when PI_SESSION_STORE_KIND=redis");
  }

  if (!redisConfig) {
    return fileStore;
  }

  const redisStore = createRedisLivoSessionStore(
    redisConfig,
    testRedisBackendFactory?.(redisConfig),
  );

  if (kind === "file" && dualWrite) {
    return new DualWriteLivoSessionStore(fileStore, [fileStore, redisStore]);
  }

  if (kind === "redis") {
    const writeStores: LivoSessionStore[] = dualWrite ? [redisStore, fileStore] : [redisStore];
    return new DualWriteLivoSessionStore(
      redisStore,
      writeStores,
      buildRedisInitializer(redisStore, fileStore, kind),
    );
  }

  return fileStore;
}

let cachedStore: InitializableLivoSessionStore | null = null;
let initPromise: Promise<void> | null = null;
let testRedisBackendFactory: ((config: RedisSessionStoreConfig) => RedisSessionBackend) | null = null;

export function setRedisSessionBackendFactoryForTests(
  factory: ((config: RedisSessionStoreConfig) => RedisSessionBackend) | null,
): void {
  testRedisBackendFactory = factory;
}

/** 进程内单例；测试可通过 resetLivoSessionStoreForTests 重置。 */
export function getLivoSessionStore(): LivoSessionStore {
  if (!cachedStore) {
    cachedStore = createLivoSessionStore();
  }
  return cachedStore;
}

/** 启动时 warm Redis 缓存（instrumentation / 测试可调用）。 */
export async function initLivoSessionStore(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const store = getLivoSessionStore() as InitializableLivoSessionStore;
      if (typeof store.initialize === "function") {
        await store.initialize();
      }
    })();
  }
  await initPromise;
}

export function resetLivoSessionStoreForTests(): void {
  cachedStore = null;
  initPromise = null;
  testRedisBackendFactory = null;
}

export type { RedisSessionStoreConfig };
