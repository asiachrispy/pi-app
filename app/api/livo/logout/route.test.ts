import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRemoteAuditEvents } from "@/lib/remote-audit-log";
import { resetLivoSessionStoreForTests } from "@/lib/auth/session-store";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

vi.mock("@/lib/livo-route-guard", () => ({
  rejectLivoIntegrationDisabled: () => null,
}));

describe("POST /api/livo/logout", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-livo-logout-"));
    mkdirSync(agentDir.value, { recursive: true });
    resetLivoSessionStoreForTests();
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "test-secret-32-byte-minimum-value");
    vi.stubEnv("PI_WEB_REMOTE", "");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    resetLivoSessionStoreForTests();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("audits livo logout with tenantId before clearing cookie", async () => {
    const { createLivoSession } = await import("@/lib/livo-sso");
    const session = createLivoSession({ livoUserId: "user-logout" });
    const req = new Request("https://pi.gottao.com/api/livo/logout", {
      method: "POST",
      headers: { cookie: `pi_livo_session=${encodeURIComponent(session.cookieValue)}` },
    });

    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const [event] = readRemoteAuditEvents(1);
    expect(event?.type).toBe("livo_logout");
    expect(event?.tenantId).toBe("user-logout");
    expect(event?.principalKind).toBe("livo");
  });
});
