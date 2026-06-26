import { join } from "node:path";
import { getAgentDir } from "@/lib/agent-dir";
import { type StoredLivoSession } from "@/lib/livo-sso";
import {
  getTenantContext,
  tenantAgentDirFor,
  type TenantContext,
} from "@/lib/livo/tenant-context";

/**
 * 租户目录解析（方案二：显式参数强制）。
 *
 * 这里只提供纯函数，不再有"网关对象"——隔离强制力来自：
 *   1) 下游存储/执行函数的 agentDir 必传参数（漏传=编译错误）；
 *   2) route 层的 cwd 归属校验（rejectLivoCwdOutsideWorkspace / realCwdBelongsToLivoUser）；
 *   3) 缓存键含 agentDir 前缀。
 * 调用点显式写出 currentAgentDir()/currentSessionDir()，把"租户取上下文、
 * 非租户取全局"的分支收口到一处，避免每个 route 重复 if-else。
 *
 * sessionDir 策略：租户所有 session 落在 `{agentDir}/sessions/` 单层目录下。
 * 租户 agentDir 本身已按用户隔离，无需再按 cwd 分子目录；单层也让
 * SessionManager.listAll(sessionDir) 能一次性拾取（它只扫单层）。
 */

/** 跨租户归属校验失败。抛出后由 withTenant 统一转 403。 */
export class TenantOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantOwnershipError";
  }
}

/**
 * 解析"当前应使用的 agentDir"，供存储函数的必传 agentDir 参数显式取值：
 *   listAllSessions(currentAgentDir())
 *
 * - 租户上下文内 → 该租户 agentDir（隔离）。
 * - 非租户路径（CLI/loopback/Bearer）→ 全局 agentDir（行为不变）。
 */
export function currentAgentDir(): string {
  const ctx = getTenantContext();
  return ctx ? ctx.agentDir : getAgentDir();
}

/** 同理解析"当前 sessionDir"（租户单层 sessions/；非租户走 pi 默认，传 undefined）。 */
export function currentSessionDir(): string | undefined {
  const ctx = getTenantContext();
  return ctx ? join(ctx.agentDir, "sessions") : undefined;
}

/** 由 Livo session 构造租户上下文（供 withTenant 使用）。 */
export function tenantContextFromLivoSession(session: StoredLivoSession): TenantContext {
  return {
    tenantId: session.livoUserId,
    agentDir: tenantAgentDirFor(session.livoUserId),
  };
}

/**
 * 由 Livo userId 直接构造租户上下文。
 * 用于 server-to-server 路径（如 /api/agent/new），其租户身份来自请求体的
 * livoUserId（而非 cookie），需显式建立上下文后再调 startRpcSession，
 * 否则执行路径会回退全局 agentDir（方案二核心漏洞点）。
 */
export function tenantContextForUserId(livoUserId: string): TenantContext {
  return {
    tenantId: livoUserId,
    agentDir: tenantAgentDirFor(livoUserId),
  };
}
