import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetLivoSessionStoreForTests } from "@/lib/auth/session-store";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

describe("GET /api/internal/session/exists", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-internal-session-"));
    mkdirSync(agentDir.value, { recursive: true });
    resetLivoSessionStoreForTests();
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "test-secret-32-byte-minimum-value");
    vi.stubEnv("PI_INTERNAL_VERIFY_TOKEN", "internal-verify-token");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    resetLivoSessionStoreForTests();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects non-loopback callers", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://pi.gottao.com/api/internal/session/exists?sid=s1", {
      headers: { authorization: "Bearer internal-verify-token" },
    }));
    expect(res.status).toBe(403);
  });

  it("returns exists=true when session is in store", async () => {
    const { createLivoSession, livoSessionExistsBySessionId } = await import("@/lib/livo-sso");
    const session = createLivoSession({ livoUserId: "user-1" });
    const sessionId = session.cookieValue.split(".")[0]!;
    expect(livoSessionExistsBySessionId(sessionId)).toBe(true);

    const { GET } = await import("./route");
    const res = await GET(new Request(`http://127.0.0.1:30141/api/internal/session/exists?sid=${sessionId}`, {
      headers: {
        host: "127.0.0.1:30141",
        authorization: "Bearer internal-verify-token",
      },
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: true, kind: "livo" });
  });

  it("returns exists=true for remote pairing sessions", async () => {
    vi.stubEnv("PI_WEB_REMOTE", "1");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      join(agentDir.value, "pi-web-remote.json"),
      JSON.stringify({
        enabled: true,
        signingSecret: "remote-signing-secret-32-bytes-min",
        allowedHostnames: [],
        sessions: [{ id: "remote-1", createdAt: new Date().toISOString(), userAgent: "test", lastSeenAt: new Date().toISOString() }],
        pairingCodes: [],
      }),
    );

    const { GET } = await import("./route");
    const res = await GET(new Request("http://127.0.0.1:30141/api/internal/session/exists?sid=remote-1&kind=remote", {
      headers: {
        host: "127.0.0.1:30141",
        authorization: "Bearer internal-verify-token",
      },
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: true, kind: "remote" });
  });

  it("returns exists=false for unknown sid", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://127.0.0.1:30141/api/internal/session/exists?sid=missing", {
      headers: {
        host: "127.0.0.1:30141",
        authorization: "Bearer internal-verify-token",
      },
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: false, kind: "livo" });
  });
});
