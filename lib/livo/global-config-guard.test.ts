import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rejectLivoGlobalModelConfigWrite } from "./global-config-guard";
import { readRemoteAuditEvents } from "@/lib/remote-audit-log";
import { resetLivoSessionStoreForTests } from "@/lib/auth/session-store";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/agent-dir", () => ({
  getAgentDir: () => agentDir.value,
}));

describe("rejectLivoGlobalModelConfigWrite", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-global-config-guard-"));
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

  it("returns null for non-livo requests", async () => {
    const req = new Request("https://pi.gottao.com/api/models-config", { method: "PUT" });
    expect(rejectLivoGlobalModelConfigWrite(req)).toBeNull();
  });

  it("blocks livo tenants and writes audit with tenantId", async () => {
    const { createLivoSession } = await import("@/lib/livo-sso");
    const session = createLivoSession({ livoUserId: "tenant-b" });
    const req = new Request("https://pi.gottao.com/api/models-config", {
      method: "PUT",
      headers: { cookie: `pi_livo_session=${encodeURIComponent(session.cookieValue)}` },
    });

    const res = rejectLivoGlobalModelConfigWrite(req);
    expect(res?.status).toBe(403);

    const [event] = readRemoteAuditEvents(1);
    expect(event?.type).toBe("global_config_denied");
    expect(event?.tenantId).toBe("tenant-b");
    expect(event?.principalKind).toBe("livo");
  });
});
