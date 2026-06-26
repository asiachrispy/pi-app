import { NextResponse } from "next/server";
import { isLivoPrincipal } from "@/lib/auth/principal";
import { resolveLivoPrincipal } from "@/lib/remote-auth";
import { runWithTenant } from "@/lib/livo/tenant-context";
import { tenantContextForUserId, TenantOwnershipError } from "@/lib/livo/tenant-gate";

/** Next.js App Router route handler 形态。 */
type RouteHandler<C = unknown, R extends Request = Request> = (
  req: R,
  ctx: C,
) => Promise<Response> | Response;

/**
 * withTenant —— 给 Livo 可达 route 注入租户上下文（方案二入口层）。
 *
 * 从 AuthPrincipal（Livo 分支）取 tenantId，不再二次读 cookie/store。
 */
export function withTenant<C = unknown, R extends Request = Request>(
  handler: RouteHandler<C, R>,
): RouteHandler<C, R> {
  return async (req: R, ctx: C): Promise<Response> => {
    const principal = resolveLivoPrincipal(req);

    const run = () => Promise.resolve(handler(req, ctx));

    if (!principal || !isLivoPrincipal(principal)) {
      return run();
    }

    const tenantCtx = tenantContextForUserId(principal.tenantId);
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
