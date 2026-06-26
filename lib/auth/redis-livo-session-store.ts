import { createClient, type RedisClientType } from "redis";
import type { LivoStoredSessionRecord, LivoSessionStore } from "./session-store";
import type { RedisSessionStoreConfig } from "./session-store-config";

export interface RedisSessionBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  scanValues(prefix: string): Promise<Array<{ key: string; value: string }>>;
  connect(): Promise<void>;
  quit(): Promise<void>;
}

function ttlSecondsForRecord(record: LivoStoredSessionRecord): number {
  const ms = Date.parse(record.expiresAt) - Date.now();
  return Math.max(1, Math.ceil(ms / 1000));
}

export class NodeRedisSessionBackend implements RedisSessionBackend {
  private client: RedisClientType | null = null;

  constructor(private readonly config: RedisSessionStoreConfig) {}

  async connect(): Promise<void> {
    if (this.client?.isOpen) return;
    const client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
      },
      password: this.config.password,
      database: this.config.database,
    });
    client.on("error", (error) => {
      console.error("[pi-app] Redis session store error:", error);
    });
    await client.connect();
    this.client = client as RedisClientType;
  }

  private requireClient(): RedisClientType {
    if (!this.client?.isOpen) {
      throw new Error("Redis session backend is not connected");
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.requireClient().get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.requireClient().set(key, value, { EX: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    await this.requireClient().del(key);
  }

  async scanValues(prefix: string): Promise<Array<{ key: string; value: string }>> {
    const client = this.requireClient();
    const entries: Array<{ key: string; value: string }> = [];
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      const value = await client.get(String(key));
      if (value) entries.push({ key: String(key), value });
    }
    return entries;
  }

  async quit(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
    this.client = null;
  }
}

export class InMemoryRedisSessionBackend implements RedisSessionBackend {
  private readonly data = new Map<string, { value: string; expiresAtMs: number }>();

  async connect(): Promise<void> {}

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAtMs) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.data.set(key, { value, expiresAtMs: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  async scanValues(prefix: string): Promise<Array<{ key: string; value: string }>> {
    const now = Date.now();
    const entries: Array<{ key: string; value: string }> = [];
    for (const [key, entry] of this.data.entries()) {
      if (!key.startsWith(prefix)) continue;
      if (now > entry.expiresAtMs) {
        this.data.delete(key);
        continue;
      }
      entries.push({ key, value: entry.value });
    }
    return entries;
  }

  async quit(): Promise<void> {
    this.data.clear();
  }
}

function storeKeyFromRedisKey(redisKey: string, prefix: string): string {
  return redisKey.slice(prefix.length);
}

function parseRecord(raw: string): LivoStoredSessionRecord | null {
  try {
    return JSON.parse(raw) as LivoStoredSessionRecord;
  } catch {
    return null;
  }
}

/** 进程内缓存 + 异步 Redis 持久化；读路径保持同步（#9c）。 */
export class RedisLivoSessionStore implements LivoSessionStore {
  private readonly cache = new Map<string, LivoStoredSessionRecord>();
  private readonly connectPromise: Promise<void>;
  private warmed = false;

  constructor(
    private readonly backend: RedisSessionBackend,
    private readonly livoKeyPrefix: string,
  ) {
    this.connectPromise = backend.connect();
  }

  private redisKey(storeKey: string): string {
    return `${this.livoKeyPrefix}${storeKey}`;
  }

  get(storeKey: string): LivoStoredSessionRecord | undefined {
    const record = this.cache.get(storeKey);
    if (!record) return undefined;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      this.cache.delete(storeKey);
      void this.persistDelete(storeKey);
      return undefined;
    }
    return record;
  }

  set(storeKey: string, record: LivoStoredSessionRecord): void {
    this.cache.set(storeKey, record);
    void this.persistSet(storeKey, record);
  }

  delete(storeKey: string): void {
    this.cache.delete(storeKey);
    void this.persistDelete(storeKey);
  }

  readAll(): Record<string, LivoStoredSessionRecord> {
    const now = Date.now();
    const store: Record<string, LivoStoredSessionRecord> = {};
    for (const [key, record] of this.cache.entries()) {
      if (Date.parse(record.expiresAt) <= now) {
        this.cache.delete(key);
        void this.persistDelete(key);
        continue;
      }
      store[key] = record;
    }
    return store;
  }

  async warmFromRedis(): Promise<void> {
    await this.connectPromise;
    const entries = await this.backend.scanValues(this.livoKeyPrefix);
    for (const entry of entries) {
      const record = parseRecord(entry.value);
      if (!record) continue;
      if (Date.parse(record.expiresAt) <= Date.now()) {
        await this.backend.del(entry.key);
        continue;
      }
      this.cache.set(storeKeyFromRedisKey(entry.key, this.livoKeyPrefix), record);
    }
    this.warmed = true;
  }

  async importMissingFrom(store: LivoSessionStore): Promise<number> {
    let imported = 0;
    for (const [storeKey, record] of Object.entries(store.readAll())) {
      if (this.get(storeKey)) continue;
      this.set(storeKey, record);
      imported += 1;
    }
    return imported;
  }

  isWarmed(): boolean {
    return this.warmed;
  }

  private async persistSet(storeKey: string, record: LivoStoredSessionRecord): Promise<void> {
    try {
      await this.connectPromise;
      await this.backend.set(
        this.redisKey(storeKey),
        JSON.stringify(record),
        ttlSecondsForRecord(record),
      );
    } catch (error) {
      console.error("[pi-app] Failed to persist Livo session to Redis:", error);
    }
  }

  private async persistDelete(storeKey: string): Promise<void> {
    try {
      await this.connectPromise;
      await this.backend.del(this.redisKey(storeKey));
    } catch (error) {
      console.error("[pi-app] Failed to delete Livo session from Redis:", error);
    }
  }

  async disposeForTests(): Promise<void> {
    await this.backend.quit();
    this.cache.clear();
    this.warmed = false;
  }
}

export function createRedisLivoSessionStore(
  config: RedisSessionStoreConfig,
  backend?: RedisSessionBackend,
): RedisLivoSessionStore {
  return new RedisLivoSessionStore(
    backend ?? new NodeRedisSessionBackend(config),
    config.livoKeyPrefix,
  );
}
