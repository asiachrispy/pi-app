import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSessionStoreVerifyEnabled,
  resolveInternalSessionVerifyOrigin,
  verifyLivoSessionExistsInternal,
  verifyRemoteSessionExistsInternal,
} from "./middleware-internal-verify";

describe("middleware-internal-verify", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("detects when internal verify is configured", () => {
    vi.stubEnv("PI_INTERNAL_VERIFY_TOKEN", "token");
    expect(isSessionStoreVerifyEnabled()).toBe(true);
    vi.stubEnv("PI_INTERNAL_VERIFY_TOKEN", "");
    expect(isSessionStoreVerifyEnabled()).toBe(false);
  });

  it("resolves loopback origin from PI_WEB_PORT", () => {
    vi.stubEnv("PI_WEB_PORT", "30142");
    expect(resolveInternalSessionVerifyOrigin()).toBe("http://127.0.0.1:30142");
  });

  it("returns true without fetch when internal verify is disabled", async () => {
    vi.stubEnv("PI_INTERNAL_VERIFY_TOKEN", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(verifyLivoSessionExistsInternal("sid-1")).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls internal exists endpoint when configured", async () => {
    vi.stubEnv("PI_INTERNAL_VERIFY_TOKEN", "internal-token");
    vi.stubEnv("PI_WEB_PORT", "30141");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ exists: true }), { status: 200 }),
    );

    await expect(verifyLivoSessionExistsInternal("sid-abc")).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:30141/api/internal/session/exists?sid=sid-abc&kind=livo",
      expect.objectContaining({
        headers: { Authorization: "Bearer internal-token" },
      }),
    );
  });

  it("calls internal exists endpoint for remote sessions", async () => {
    vi.stubEnv("PI_INTERNAL_VERIFY_TOKEN", "internal-token");
    vi.stubEnv("PI_WEB_PORT", "30141");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ exists: true, kind: "remote" }), { status: 200 }),
    );

    await expect(verifyRemoteSessionExistsInternal("remote-sid")).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:30141/api/internal/session/exists?sid=remote-sid&kind=remote",
      expect.objectContaining({
        headers: { Authorization: "Bearer internal-token" },
      }),
    );
  });
});
