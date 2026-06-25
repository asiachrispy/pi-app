import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";
import { livoUserWorkspaceRoot } from "@/lib/livo-sso";

/**
 * Per-request tenant context for Livo multi-tenant isolation (方案二：显式参数强制).
 *
 * ALS 仅负责"运输"：把入口解析出的 tenantId / agentDir 带到深层调用栈。
 * 真正的隔离强制由「显式必传参数 + 缓存键含 tenantId + fail-closed」保证，
 * 而非依赖 ALS 本身。任何碰租户数据的函数都应从 ctx 取出 agentDir/sessionDir
 * 后显式传参，绝不在缺失时静默回退全局目录。
 *
 * 凭证 / 模型配置不在此隔离 —— 见 resolve-model.ts，钉死全局路径（统一付费）。
 */
export interface TenantContext {
  /** Livo 用户 id（本期 tenantId = livoUserId）。 */
  tenantId: string;
  /** 该租户的 agentDir 绝对路径（隔离 sessions/preferences/scene/skills/memory）。 */
  agentDir: string;
}

/** 租户工作区根下存放 pi agent 数据的子目录名。 */
export const TENANT_AGENT_DIR_NAME = ".pi-agent";

/** 由 Livo userId 计算该租户的 agentDir。 */
export function tenantAgentDirFor(livoUserId: string): string {
  return join(livoUserWorkspaceRoot(livoUserId), TENANT_AGENT_DIR_NAME);
}

const storage = new AsyncLocalStorage<TenantContext>();

/** 在给定租户上下文中运行 fn。 */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** 当前租户上下文；不在租户作用域内时返回 null（非租户路径如 CLI/loopback/Bearer）。 */
export function getTenantContext(): TenantContext | null {
  return storage.getStore() ?? null;
}

/**
 * 强制取当前租户上下文，缺失即 throw（fail-closed）。
 * 供"已确定是租户请求、缺上下文即程序错误"的代码使用，杜绝静默回退全局。
 */
export function requireTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "Tenant context required but missing — a Livo tenant route ran outside runWithTenant (fail-closed).",
    );
  }
  return ctx;
}
