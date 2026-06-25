import { NextResponse } from "next/server";
import { readLivoSession } from "@/lib/livo-sso";

/**
 * 全局配置写保护（方案二 Step 6）。
 *
 * models.json / 默认模型等是全局共享配置（统一付费）。Livo 租户不应改动它们，
 * 否则一个用户的修改会影响所有租户。带 Livo session 的请求调用全局配置写接口时，
 * 返回 403；非 Livo（管理员 / loopback / Bearer）放行。
 *
 * 用法：在全局配置写接口（PUT/POST/DELETE）开头：
 *   const rejected = rejectLivoGlobalConfigWrite(req);
 *   if (rejected) return rejected;
 */
export function rejectLivoGlobalConfigWrite(req: Request): NextResponse | null {
  if (readLivoSession(req)) {
    return NextResponse.json(
      { error: "Global model configuration is read-only for Livo tenants" },
      { status: 403 },
    );
  }
  return null;
}
