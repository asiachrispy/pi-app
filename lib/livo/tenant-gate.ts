import { join, resolve } from "node:path";
import {
  cwdBelongsToLivoUser,
  livoUserWorkspaceRoot,
  type StoredLivoSession,
} from "@/lib/livo-sso";
import {
  getTenantContext,
  requireTenantContext,
  tenantAgentDirFor,
  type TenantContext,
} from "@/lib/livo/tenant-context";

/**
 * TenantGate —— 多租户隔离的单一收口（方案二：显式参数强制）。
 *
 * 用法：route 经 withTenant 建立上下文后，调 `gate()` 取本请求的网关，
 * 再把 `gate.agentDir` / `gate.sessionDir()` **显式传给**下游存储/执行函数。
 * 网关本身不隐藏 agentDir —— 它只是把 fail-closed 取上下文 + 归属校验 + 路径
 * 计算收口到一处，强制力仍由"下游函数必传参数"的类型签名保证。
 *
 * sessionDir 策略：租户的所有 session 直接落在 `{agentDir}/sessions/` 单层目录下。
 * 租户 agentDir 本身已按用户隔离，无需再按 cwd 分子目录；单层也让
 * SessionManager.listAll(sessionDir) 能一次性拾取（它只扫单层）。
 */
export class TenantGate {
  constructor(private readonly ctx: TenantContext) {}

  get tenantId(): string {
    return this.ctx.tenantId;
  }

  get agentDir(): string {
    return this.ctx.agentDir;
  }

  /** 该租户所有 session 的存放目录（单层）。 */
  sessionDir(): string {
    return join(this.ctx.agentDir, "sessions");
  }

  /** 租户工作区根（文件/cwd 归属判定的边界）。 */
  workspaceRoot(): string {
    return resolve(livoUserWorkspaceRoot(this.ctx.tenantId));
  }

  /** cwd 是否属于本租户工作区；不属于则返回 false（调用方决定 403）。 */
  ownsCwd(cwd: string | null | undefined): boolean {
    return cwdBelongsToLivoUser(cwd, this.ctx.tenantId);
  }

  /** 断言 cwd 属于本租户，否则 throw（fail-closed）。 */
  assertOwnsCwd(cwd: string | null | undefined): void {
    if (!this.ownsCwd(cwd)) {
      throw new TenantOwnershipError(`cwd is outside tenant ${this.ctx.tenantId} workspace`);
    }
  }
}

/** 跨租户归属校验失败。route 层应捕获并转成 403。 */
export class TenantOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantOwnershipError";
  }
}

/**
 * 取本请求的租户网关，缺上下文即 throw（fail-closed）。
 * 仅可在 withTenant 作用域内（即已确认是 Livo 租户请求）调用。
 */
export function gate(): TenantGate {
  return new TenantGate(requireTenantContext());
}

/** 当前是否处于租户上下文（非租户路径返回 null 网关）。 */
export function tenantGateOrNull(): TenantGate | null {
  const ctx = getTenantContext();
  return ctx ? new TenantGate(ctx) : null;
}

/** 由 Livo session 构造租户上下文（供 withTenant 使用）。 */
export function tenantContextFromLivoSession(session: StoredLivoSession): TenantContext {
  return {
    tenantId: session.livoUserId,
    agentDir: tenantAgentDirFor(session.livoUserId),
  };
}
