import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AssistantMessage } from "@/lib/types";
import { getTenantContext } from "@/lib/livo/tenant-context";
import { currentAgentDir } from "@/lib/livo/tenant-gate";
import { notifyLivoTokenUsage } from "@/lib/livo/usage-callback";
import type { TenantTokenUsage } from "@/lib/livo/tenant-usage";

export const USAGE_LEDGER_FILENAME = "token-usage.jsonl";

export interface UsageLedgerEvent {
  ts: string;
  tenantId?: string;
  sessionId: string;
  messageTimestamp?: number;
  model?: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
}

export function usageLedgerPath(agentDir: string): string {
  return join(agentDir, USAGE_LEDGER_FILENAME);
}

export function usageMessageKey(sessionId: string, messageTimestamp?: number): string {
  return `${sessionId}:${messageTimestamp ?? 0}`;
}

export function appendUsageLedgerEvent(
  agentDir: string,
  event: Omit<UsageLedgerEvent, "ts">,
): UsageLedgerEvent {
  const record: UsageLedgerEvent = { ts: new Date().toISOString(), ...event };
  const path = usageLedgerPath(agentDir);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export function readUsageLedgerEvents(agentDir: string): UsageLedgerEvent[] {
  const path = usageLedgerPath(agentDir);
  try {
    const raw = readFileSync(path, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as UsageLedgerEvent);
  } catch {
    return [];
  }
}

export function aggregateUsageLedger(events: UsageLedgerEvent[]): TenantTokenUsage {
  const acc: TenantTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalCost: 0,
    sessionCount: 0,
    messageCount: 0,
  };
  const sessions = new Set<string>();
  for (const event of events) {
    acc.inputTokens += event.inputTokens;
    acc.outputTokens += event.outputTokens;
    acc.cacheReadTokens += event.cacheReadTokens;
    acc.cacheWriteTokens += event.cacheWriteTokens;
    acc.totalCost += event.totalCost;
    acc.messageCount += 1;
    sessions.add(event.sessionId);
  }
  acc.sessionCount = sessions.size;
  return acc;
}

export function mergeTenantTokenUsage(base: TenantTokenUsage, extra: TenantTokenUsage): TenantTokenUsage {
  return {
    inputTokens: base.inputTokens + extra.inputTokens,
    outputTokens: base.outputTokens + extra.outputTokens,
    cacheReadTokens: base.cacheReadTokens + extra.cacheReadTokens,
    cacheWriteTokens: base.cacheWriteTokens + extra.cacheWriteTokens,
    totalCost: base.totalCost + extra.totalCost,
    sessionCount: Math.max(base.sessionCount, extra.sessionCount),
    messageCount: base.messageCount + extra.messageCount,
  };
}

/** rpc-manager message_end 挂点：assistant 带 usage 时增量写入租户 jsonl。 */
export function recordUsageFromAssistantMessage(sessionId: string, message: AssistantMessage): UsageLedgerEvent | null {
  const usage = message.usage;
  if (!usage) return null;

  const agentDir = currentAgentDir();
  const tenantId = getTenantContext()?.tenantId;

  const record = appendUsageLedgerEvent(agentDir, {
    tenantId,
    sessionId,
    messageTimestamp: message.timestamp,
    model: message.model,
    provider: message.provider,
    inputTokens: usage.input ?? 0,
    outputTokens: usage.output ?? 0,
    cacheReadTokens: usage.cacheRead ?? 0,
    cacheWriteTokens: usage.cacheWrite ?? 0,
    totalCost: usage.cost?.total ?? 0,
  });
  void notifyLivoTokenUsage(record).catch(() => {});
  return record;
}
