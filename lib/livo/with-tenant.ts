import { NextResponse } from "next/server";
import { readLivoSession } from "@/lib/livo-sso";
import { runWithTenant } from "@/lib/livo/tenant-context";
import { tenantContextFromLivoSession, TenantOwnershipError } from "@/lib/livo/tenant-gate";

/** Next.js App Router route handler 形态。 */
type RouteHandler<C = unknown> = (req: Request, ctx: C) => Promise<Response> | Response;

/**
 * withTenant —— 给 Livo 可达 route 注入租户上下文（方案二入口层）。
 *
 * 行为：
 * - 请求带有效 Livo session → 构造 TenantContext，在 runWithTenant 作用域内执行 handler。
 *   handler 内部经 gate() 取 agentDir/sessionDir 显式下传。
 * - 请求无 Livo session（CLI / loopback / Bearer 等非租户路径）→ 直接透传，
 *   下游走全局 getAgentDir()，行为不变。
 * - TenantOwnershipError（跨租户归属校验失败）→ 统一转 403。
 *
 * 注意：本包装器只负责"有 Livo cookie 时建立上下文"。它不强制要求请求必须是
 * 租户请求——非租户路径合法透传。真正的隔离强制在下游"必传 agentDir 参数"的
 * 类型签名上；fail-closed 体现在：一旦进入租户上下文，下游取不到 ctx 即 throw。
 */
export function withTenant<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req: Request, ctx: C): Promise<Response> => {
    const livoSession = readLivoSession(req);

    const run = () => Promise.resolve(handler(req, ctx));

    if (!livoSession) {
      // 非租户路径：透传（loopback / Bearer / 未登录 SSO 流程）。
      return run();
    }

    const tenantCtx = tenantContextFromLivoSession(livoSession);
    try {
      return await runWithTenant(tenantCtx, run);
    } catch (error) {
      if (error instanceof TenantOwnershipError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      throw error;
    }
  };
}
