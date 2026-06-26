import { buildTenantTokenUsage } from "@/lib/livo/tenant-usage";

export interface BudgetCheckResult {
  exceeded: boolean;
  limitUsd: number | null;
  spentUsd: number;
  warnOnly: boolean;
  message?: string;
}

export function resolveTenantBudgetUsd(): number | null {
  const raw = process.env.PI_LIVO_TENANT_BUDGET_USD?.trim();
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** 默认 warn-only；`PI_LIVO_BUDGET_ENFORCE=1` 预留硬拦截（路线 3）。 */
export function isBudgetWarnOnly(): boolean {
  return process.env.PI_LIVO_BUDGET_ENFORCE !== "1";
}

export async function checkBudget(agentDir: string): Promise<BudgetCheckResult> {
  const limitUsd = resolveTenantBudgetUsd();
  const usage = await buildTenantTokenUsage(agentDir);
  const spentUsd = usage.totalCost;
  const warnOnly = isBudgetWarnOnly();

  if (limitUsd === null) {
    return { exceeded: false, limitUsd: null, spentUsd, warnOnly };
  }

  const exceeded = spentUsd >= limitUsd;
  return {
    exceeded,
    limitUsd,
    spentUsd,
    warnOnly,
    message: exceeded
      ? `Tenant budget exceeded: $${spentUsd.toFixed(4)} / $${limitUsd.toFixed(2)}`
      : undefined,
  };
}

/** prompt 前调用：超额仅打日志，不阻断（12c warn-only）。 */
export async function warnIfBudgetExceeded(
  agentDir: string,
  context?: { sessionId?: string },
): Promise<BudgetCheckResult | null> {
  const result = await checkBudget(agentDir);
  if (!result.exceeded) return null;
  console.warn("[pi-app] budget warn-only:", result.message, context ?? {});
  return result;
}
