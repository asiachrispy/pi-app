/** Pi Web Livo session store 环境变量解析（#9b–#9c）。 */

export interface RedisSessionStoreConfig {
  host: string;
  port: number;
  database: number;
  password?: string;
  /** 含 `livo:` 段，例如 `pi:session:livo:` */
  livoKeyPrefix: string;
}

export function resolveSessionStoreDualWrite(): boolean {
  return process.env.PI_SESSION_STORE_DUAL_WRITE === "1";
}

export function resolveLivoRedisKeyPrefix(): string {
  const raw = process.env.PI_SESSION_STORE_PREFIX?.trim() || "pi:session:";
  const normalized = raw.endsWith(":") ? raw : `${raw}:`;
  return normalized.endsWith("livo:") ? normalized : `${normalized}livo:`;
}

export function resolveRedisSessionStoreConfig(): RedisSessionStoreConfig | null {
  const rawUrl = process.env.PI_SESSION_STORE_URL?.trim();
  if (!rawUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid PI_SESSION_STORE_URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(`PI_SESSION_STORE_URL must use redis:// or rediss:// scheme`);
  }

  const database = parsed.pathname && parsed.pathname.length > 1
    ? Number.parseInt(parsed.pathname.slice(1), 10)
    : 0;
  if (!Number.isFinite(database) || database < 0) {
    throw new Error(`Invalid Redis database in PI_SESSION_STORE_URL: ${rawUrl}`);
  }

  const password = process.env.PI_SESSION_STORE_PASSWORD?.trim()
    || parsed.password
    || process.env.REDIS_PASSWORD?.trim()
    || undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    database,
    password: password || undefined,
    livoKeyPrefix: resolveLivoRedisKeyPrefix(),
  };
}
