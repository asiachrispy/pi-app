import { describe, expect, it, vi } from "vitest";
import { issueSessionCookieValue, parseSessionCookieValue } from "./signed-session-cookie";

describe("signed session cookie", () => {
  const secret = "test-secret-32-byte-minimum-value";

  it("issues and parses a signed session cookie", () => {
    const expiresAtMs = Date.now() + 60_000;
    const value = issueSessionCookieValue("session-1", expiresAtMs, secret);

    expect(parseSessionCookieValue(value, secret)).toEqual({
      sessionId: "session-1",
      expiresAtMs,
    });
  });

  it("rejects cookies signed with a different secret", () => {
    const value = issueSessionCookieValue("session-1", Date.now() + 60_000, secret);

    expect(parseSessionCookieValue(value, "different-secret-32-byte-value")).toBeNull();
  });

  it("rejects expired cookies", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-26T00:00:00Z"));
      const value = issueSessionCookieValue("session-1", Date.now() + 1_000, secret);
      vi.setSystemTime(new Date("2026-06-26T00:00:02Z"));

      expect(parseSessionCookieValue(value, secret)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects malformed or tampered cookie values", () => {
    const value = issueSessionCookieValue("session-1", Date.now() + 60_000, secret);
    const [sessionId, expiresAtMs] = value.split(".");

    expect(parseSessionCookieValue("", secret)).toBeNull();
    expect(parseSessionCookieValue("missing.parts", secret)).toBeNull();
    expect(parseSessionCookieValue(`${sessionId}.not-a-number.signature`, secret)).toBeNull();
    expect(parseSessionCookieValue(`${sessionId}.${expiresAtMs}.short`, secret)).toBeNull();
    expect(parseSessionCookieValue(value.replace("session-1", "session-2"), secret)).toBeNull();
  });
});
