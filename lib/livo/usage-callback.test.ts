import { afterEach, describe, expect, it, vi } from "vitest";
import { isLivoUsageCallbackEnabled, notifyLivoTokenUsage, shouldNotifyLivoUsage } from "./usage-callback";

const originalEnv = process.env;

describe("usage-callback", () => {
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("requires tenant and session metadata", () => {
    expect(
      shouldNotifyLivoUsage({
        tenantId: "user-1",
        sessionId: "sid-1",
        ts: "2026-06-27T00:00:00.000Z",
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCost: 0.01,
      }),
    ).toBe(true);
    expect(
      shouldNotifyLivoUsage({
        tenantId: "",
        sessionId: "sid-1",
        ts: "2026-06-27T00:00:00.000Z",
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCost: 0.01,
      }),
    ).toBe(false);
  });

  it("posts usage callback when enabled", async () => {
    process.env = {
      ...originalEnv,
      PI_LIVO_USAGE_CALLBACK_ENABLED: "1",
      PI_LIVO_BASE_URL: "https://livo.example.com/",
      PI_WEB_REMOTE_TOKEN: "server-token",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const ok = await notifyLivoTokenUsage({
      tenantId: "user-1",
      sessionId: "sid-1",
      model: "gpt-4",
      provider: "openai",
      ts: "2026-06-27T00:00:00.000Z",
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 0.02,
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://livo.example.com/pi-agent/callbacks/usage",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer server-token",
        },
      }),
    );
  });

  it("skips when callback is disabled", async () => {
    process.env = { ...originalEnv, PI_LIVO_USAGE_CALLBACK_ENABLED: "" };
    expect(isLivoUsageCallbackEnabled()).toBe(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      notifyLivoTokenUsage({
        tenantId: "user-1",
        sessionId: "sid-1",
        ts: "2026-06-27T00:00:00.000Z",
        inputTokens: 1,
        outputTokens: 1,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCost: 0.01,
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
