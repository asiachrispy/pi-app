import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveLivoRedisKeyPrefix,
  resolveRedisSessionStoreConfig,
  resolveSessionStoreDualWrite,
} from "./session-store-config";

describe("session-store-config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when redis url is unset", () => {
    vi.stubEnv("PI_SESSION_STORE_URL", "");
    expect(resolveRedisSessionStoreConfig()).toBeNull();
  });

  it("parses redis url with database and password fallback", () => {
    vi.stubEnv("PI_SESSION_STORE_URL", "redis://127.0.0.1:6379/3");
    vi.stubEnv("PI_SESSION_STORE_PASSWORD", "secret");
    vi.stubEnv("PI_SESSION_STORE_PREFIX", "pi:session:");

    expect(resolveRedisSessionStoreConfig()).toEqual({
      host: "127.0.0.1",
      port: 6379,
      database: 3,
      password: "secret",
      livoKeyPrefix: "pi:session:livo:",
    });
  });

  it("normalizes prefix to include livo segment", () => {
    vi.stubEnv("PI_SESSION_STORE_PREFIX", "pi:session:livo:");
    expect(resolveLivoRedisKeyPrefix()).toBe("pi:session:livo:");
  });

  it("reads dual write flag", () => {
    vi.stubEnv("PI_SESSION_STORE_DUAL_WRITE", "1");
    expect(resolveSessionStoreDualWrite()).toBe(true);
  });
});
