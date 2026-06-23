import { describe, expect, it, vi } from "vitest";
import { isConnectionError, probeServer } from "./api-fetch";

describe("api-fetch", () => {
  it("detects network and timeout errors", () => {
    expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectionError(new DOMException("Timed out", "TimeoutError"))).toBe(true);
    expect(isConnectionError(new Error("HTTP 401"))).toBe(false);
  });

  it("probes a client-visible endpoint instead of loopback-only health", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ remoteEnabled: true })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeServer()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/remote/client");
  });
});
