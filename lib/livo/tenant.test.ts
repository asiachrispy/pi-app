import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runWithTenant,
  getTenantContext,
  requireTenantContext,
  tenantAgentDirFor,
  TENANT_AGENT_DIR_NAME,
} from "@/lib/livo/tenant-context";
import { currentAgentDir, currentSessionDir } from "@/lib/livo/tenant-gate";
import { getDefaultAgentDir } from "@/lib/agent-dir";
import { isTenantAgentDir } from "@/lib/session-reader";

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

describe("currentAgentDir / currentSessionDir (租户取上下文, 非租户回退全局)", () => {
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

describe("isTenantAgentDir (#3: dev 隔离目录不得误判为租户单层布局)", () => {
  beforeEach(() => {
    vi.stubEnv("PI_WEB_LIVO_WORKSPACE_ROOT", "/data/pi-agent/workspaces/livo");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("租户 agentDir（workspace 根下的 .pi-agent）判为租户", () => {
    expect(
      isTenantAgentDir("/data/pi-agent/workspaces/livo/users/user-1/.pi-agent"),
    ).toBe(true);
  });

  it("dev 隔离目录（~/tmp/pi-dev-agent）不是租户", () => {
    expect(isTenantAgentDir("/Users/mk/tmp/pi-dev-agent")).toBe(false);
  });

  it("全局默认目录不是租户", () => {
    expect(isTenantAgentDir(getDefaultAgentDir())).toBe(false);
  });

  it("工作区根下但不以 .pi-agent 结尾的目录不是租户", () => {
    expect(
      isTenantAgentDir("/data/pi-agent/workspaces/livo/users/user-1/meetings"),
    ).toBe(false);
  });
});
