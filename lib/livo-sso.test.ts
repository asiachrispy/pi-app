import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

describe("livo sso", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-livo-sso-"));
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "test-secret-32-byte-minimum-value");
    vi.stubEnv("PI_LIVO_BASE_URL", "https://livo.gottao.com/livoApi/livoAgent");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts only pi.gottao.com return targets", async () => {
    const { normalizePiReturnTo } = await import("./livo-sso");
    expect(normalizePiReturnTo(undefined)).toBe("https://pi.gottao.com/app/");
    expect(normalizePiReturnTo("/app/?session=s1")).toBe("https://pi.gottao.com/app/?session=s1");
    expect(normalizePiReturnTo("https://pi.gottao.com/app/?session=s1")).toBe("https://pi.gottao.com/app/?session=s1");
    expect(normalizePiReturnTo("/?session=s1")).toBe("https://pi.gottao.com/app/?session=s1");
    expect(() => normalizePiReturnTo("https://evil.example.com/")).toThrow(/returnTo/);
  });

  it("creates and reads an opaque livo session cookie", async () => {
    const { createLivoSession, readLivoSession } = await import("./livo-sso");
    const session = createLivoSession({
      livoUserId: "user-1",
      email: "user@example.com",
      name: "Chris",
    });
    const req = new Request("https://pi.gottao.com/api/livo/me", {
      headers: { cookie: `pi_livo_session=${encodeURIComponent(session.cookieValue)}` },
    });

    const read = readLivoSession(req);

    expect(read?.livoUserId).toBe("user-1");
    expect(read?.email).toBe("user@example.com");
  });

  it("returns null for missing livo session cookie", async () => {
    const { readLivoSession } = await import("./livo-sso");
    const req = new Request("https://pi.gottao.com/api/livo/me");
    expect(readLivoSession(req)).toBeNull();
  });
});
