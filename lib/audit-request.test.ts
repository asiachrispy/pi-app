import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendRequestAuditEvent } from "./audit-request";
import { readRemoteAuditEvents } from "./remote-audit-log";
import { resetLivoSessionStoreForTests } from "./auth/session-store";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

describe("appendRequestAuditEvent", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-audit-request-"));
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

  it("fills tenantId and principalKind from livo session", async () => {
    const { createLivoSession } = await import("./livo-sso");
    const session = createLivoSession({ livoUserId: "tenant-a", email: "a@example.com" });
    const req = new Request("https://pi.gottao.com/api/livo/logout", {
      method: "POST",
      headers: {
        cookie: `pi_livo_session=${encodeURIComponent(session.cookieValue)}`,
        host: "127.0.0.1:30141",
      },
    });

    appendRequestAuditEvent(req, { type: "livo_logout" });

    const [event] = readRemoteAuditEvents(1);
    expect(event?.type).toBe("livo_logout");
    expect(event?.tenantId).toBe("tenant-a");
    expect(event?.principalKind).toBe("livo");
    expect(event?.path).toBe("/api/livo/logout");
    expect(event?.method).toBe("POST");
  });
});
