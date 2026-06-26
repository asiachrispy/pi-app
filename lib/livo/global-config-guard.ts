import { NextResponse } from "next/server";
import { readLivoSession } from "@/lib/livo-sso";

/**
 * 全局模型配置写保护（方案二 Step 6，收窄版）。
 *
 * 凭证 / models.json / 默认模型是全局共享（统一付费）。Livo 租户不应改动它们。
 * preferences / scene-overrides / skills 已租户化到各 agentDir，不在此拦截。
 *
 * 用法：在全局模型写接口（PUT/POST/DELETE）开头：
 *   const rejected = rejectLivoGlobalModelConfigWrite(req);
 *   if (rejected) return rejected;
 */
export function rejectLivoGlobalModelConfigWrite(req: Request): NextResponse | null {
  if (readLivoSession(req)) {
    return NextResponse.json(
      { error: "Global model configuration is read-only for Livo tenants" },
      { status: 403 },
    );
  }
  return null;
}

/** @deprecated 使用 rejectLivoGlobalModelConfigWrite；保留别名避免大范围重命名。 */
export const rejectLivoGlobalConfigWrite = rejectLivoGlobalModelConfigWrite;
