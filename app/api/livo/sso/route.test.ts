import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

describe("Livo SSO routes", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-livo-sso-routes-"));
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "test-secret-32-byte-minimum-value");
    vi.stubEnv("PI_LIVO_BASE_URL", "https://livo.gottao.com/livoApi/livoAgent");
    vi.stubEnv("PI_LIVO_WEB_LOGIN_URL", "https://livo.gottao.com/auth/login");
    vi.stubEnv("PI_LIVO_SSO_VERIFY_TOKEN", "verify-secret");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("start redirects to Livo login with returnTo", async () => {
    const { GET } = await import("./start/route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/sso/start?returnTo=%2F%3Fsession%3Ds1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("https://livo.gottao.com/auth/login");
    expect(res.headers.get("location")).toContain("redirect=");
  });

  it("returns 404 when livo integration is disabled", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "");
    const { GET } = await import("./start/route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/sso/start?returnTo=%2Fapp%2F"));

    expect(res.status).toBe(404);
  });

  it("start rejects external returnTo", async () => {
    const { GET } = await import("./start/route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/sso/start?returnTo=https%3A%2F%2Fevil.example%2F"));

    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
  });

  it("callback verifies ticket and sets cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      data: {
        userId: "user-1",
        email: "user@example.com",
        name: "Chris",
        returnTo: "https://pi.gottao.com/app/",
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const { GET } = await import("./callback/route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/sso/callback?ticket=pst_1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://pi.gottao.com/app/");
    expect(res.headers.get("set-cookie")).toContain("pi_livo_session=");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("callback rejects external returnTo without setting cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      data: {
        userId: "user-1",
        returnTo: "https://evil.example/",
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const { GET } = await import("./callback/route");
    const res = await GET(new Request("https://pi.gottao.com/api/livo/sso/callback?ticket=pst_1"));

    expect(res.status).toBe(400);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
