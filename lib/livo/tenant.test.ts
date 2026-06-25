import { describe, it, expect } from "vitest";
import {
  runWithTenant,
  getTenantContext,
  requireTenantContext,
  tenantAgentDirFor,
  TENANT_AGENT_DIR_NAME,
} from "@/lib/livo/tenant-context";
import { TenantGate, currentAgentDir, currentSessionDir, gate } from "@/lib/livo/tenant-gate";
import { getDefaultAgentDir } from "@/lib/agent-dir";

const CTX = { tenantId: "user-1", agentDir: "/data/pi-agent/workspaces/livo/users/user-1/.pi-agent" };

describe("tenant-context (方案二: ALS 仅运输 + fail-closed)", () => {
  it("无上下文时 getTenantContext 返回 null（非租户路径）", () => {
    expect(getTenantContext()).toBeNull();
  });

  it("无上下文时 requireTenantContext throw（fail-closed，不静默回退）", () => {
    expect(() => requireTenantContext()).toThrow(/Tenant context required/);
  });

  it("runWithTenant 内可取到上下文", () => {
    runWithTenant(CTX, () => {
      expect(getTenantContext()).toEqual(CTX);
      expect(requireTenantContext().tenantId).toBe("user-1");
    });
  });

  it("tenantAgentDirFor 落在用户工作区根下的 .pi-agent", () => {
    const dir = tenantAgentDirFor("user-1");
    expect(dir).toContain("/users/user-1/");
    expect(dir.endsWith(TENANT_AGENT_DIR_NAME)).toBe(true);
  });
});

describe("currentAgentDir / currentSessionDir (租户取 gate, 非租户回退全局)", () => {
  it("非租户路径回退全局 agentDir，sessionDir 为 undefined（走 pi 默认）", () => {
    expect(currentAgentDir()).toBe(getDefaultAgentDir());
    expect(currentSessionDir()).toBeUndefined();
  });

  it("租户路径返回租户 agentDir 与单层 sessions 目录", () => {
    runWithTenant(CTX, () => {
      expect(currentAgentDir()).toBe(CTX.agentDir);
      expect(currentSessionDir()).toBe(`${CTX.agentDir}/sessions`);
    });
  });
});

describe("TenantGate", () => {
  it("sessionDir 是 agentDir 下的单层 sessions", () => {
    const g = new TenantGate(CTX);
    expect(g.sessionDir()).toBe(`${CTX.agentDir}/sessions`);
    expect(g.tenantId).toBe("user-1");
  });

  it("ownsCwd 接受本租户工作区内路径、拒绝他人路径", () => {
    const g = new TenantGate(CTX);
    expect(g.ownsCwd("/data/pi-agent/workspaces/livo/users/user-1/meetings/m1")).toBe(true);
    expect(g.ownsCwd("/data/pi-agent/workspaces/livo/users/user-2/meetings/m1")).toBe(false);
    expect(g.ownsCwd(null)).toBe(false);
  });

  it("assertOwnsCwd 对跨租户路径 throw", () => {
    const g = new TenantGate(CTX);
    expect(() => g.assertOwnsCwd("/data/pi-agent/workspaces/livo/users/user-2/x")).toThrow();
  });

  it("gate() 在无上下文时 throw（fail-closed）", () => {
    expect(() => gate()).toThrow();
  });
});
