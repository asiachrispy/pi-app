import { createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetLivoSessionStoreForTests } from "@/lib/auth/session-store";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

describe("livo sso", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-livo-sso-"));
    resetLivoSessionStoreForTests();
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "test-secret-32-byte-minimum-value");
    vi.stubEnv("PI_LIVO_BASE_URL", "https://livo.gottao.com/livoApi/livoAgent");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    resetLivoSessionStoreForTests();
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
    const { createLivoSession, livoSessionExistsBySessionId, readLivoSession } = await import("./livo-sso");
    const session = createLivoSession({
      livoUserId: "user-1",
      email: "user@example.com",
      name: "Chris",
    });
    const sessionId = session.cookieValue.split(".")[0]!;
    expect(livoSessionExistsBySessionId(sessionId)).toBe(true);
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

  it("ignores livo cookies when livo sso is disabled", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "");
    const { createLivoSession, readLivoSession } = await import("./livo-sso");
    const session = createLivoSession({ livoUserId: "user-1" });
    const req = new Request("https://pi.gottao.com/api/default-cwd", {
      headers: { cookie: `pi_livo_session=${encodeURIComponent(session.cookieValue)}` },
    });

    expect(readLivoSession(req)).toBeNull();
  });

  it("returns null instead of throwing when a livo cookie exists without a secret", async () => {
    const { issueSessionCookieValue } = await import("./signed-session-cookie");
    const value = issueSessionCookieValue("sid", Date.now() + 60_000, "test-secret-32-byte-minimum-value");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "");
    const { readLivoSessionCookieValue } = await import("./livo-sso");

    expect(readLivoSessionCookieValue(value)).toBeNull();
  });

  it("returns null for a signed cookie value without a stored session", async () => {
    const { readLivoSessionCookieValue } = await import("./livo-sso");
    const { issueSessionCookieValue } = await import("./signed-session-cookie");
    const value = issueSessionCookieValue("missing-session", Date.now() + 60_000, "test-secret-32-byte-minimum-value");

    expect(readLivoSessionCookieValue(value)).toBeNull();
  });

  it("reads legacy sessions stored by hashed sid key", async () => {
    const secret = "test-secret-32-byte-minimum-value";
    const sid = "legacy-session-id";
    const expiresAt = new Date(Date.now() + 60_000);
    const legacyKey = createHmac("sha256", secret).update(sid).digest("base64url");
    mkdirSync(join(agentDir.value, "auth"), { recursive: true });
    writeFileSync(
      join(agentDir.value, "auth", "livo-sessions.json"),
      JSON.stringify({
        [legacyKey]: {
          livoUserId: "user-legacy",
          email: "legacy@example.com",
          sidHash: legacyKey,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      }),
    );
    const { readLivoSessionCookieValue } = await import("./livo-sso");
    const { issueSessionCookieValue } = await import("./signed-session-cookie");
    const value = issueSessionCookieValue(sid, expiresAt.getTime(), secret);

    const read = readLivoSessionCookieValue(value);

    expect(read?.livoUserId).toBe("user-legacy");
    expect(read?.email).toBe("legacy@example.com");
    expect(read?.storeKey).toBe(legacyKey);
  });

  it("resolves livo custom paths inside the current user's workspace only", async () => {
    vi.stubEnv("PI_WEB_LIVO_WORKSPACE_ROOT", "/data/pi-agent/workspaces/livo");
    const { resolveLivoUserWorkspacePath } = await import("./livo-sso");

    expect(resolveLivoUserWorkspacePath("", "user-1")).toBe("/data/pi-agent/workspaces/livo/users/user-1");
    expect(resolveLivoUserWorkspacePath("meetings/m1", "user-1")).toBe("/data/pi-agent/workspaces/livo/users/user-1/meetings/m1");
    expect(resolveLivoUserWorkspacePath("/data/pi-agent/workspaces/livo/users/user-1/meetings/m1", "user-1")).toBe("/data/pi-agent/workspaces/livo/users/user-1/meetings/m1");
    expect(resolveLivoUserWorkspacePath("../user-2", "user-1")).toBeNull();
    expect(resolveLivoUserWorkspacePath("/etc", "user-1")).toBeNull();
  });

  it.skipIf(process.platform === "win32")("rejects symlink escapes from livo realpath checks", async () => {
    const root = mkdtempSync(join(tmpdir(), "pi-livo-root-"));
    const outside = mkdtempSync(join(tmpdir(), "pi-livo-outside-"));
    try {
      vi.stubEnv("PI_WEB_LIVO_WORKSPACE_ROOT", root);
      const userRoot = join(root, "users", "user-1");
      mkdirSync(userRoot, { recursive: true });
      symlinkSync(outside, join(userRoot, "linked-outside"));

      const { realCwdBelongsToLivoUser } = await import("./livo-sso");
      expect(realCwdBelongsToLivoUser(join(userRoot, "linked-outside"), "user-1")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
