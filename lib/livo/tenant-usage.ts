import type { SessionMessageEntry } from "@/lib/types";
import { getSessionEntries } from "@/lib/session-reader";
import {
  aggregateUsageLedger,
  mergeTenantTokenUsage,
  readUsageLedgerEvents,
  usageMessageKey,
  type UsageLedgerEvent,
} from "@/lib/livo/record-usage";
import { listAllSessions } from "@/lib/session-reader";
import type { SessionInfo } from "@/lib/types";

/**
 * Per-tenant token / cost 聚合（方案二 Step 5 + M3 增量 jsonl）。
 *
 * 数据来源：
 * 1. **增量**：`token-usage.jsonl`（recordUsage / message_end 写入）
 * 2. **历史**：session 文件内 assistant usage（ledger 已覆盖的消息按 key 去重跳过）
 *
 * 隔离：agentDir 决定范围；ledger 与 session 均在租户 agentDir 下。
 */
export interface TenantTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
  /** 参与统计的 session 数。 */
  sessionCount: number;
  /** 含 usage 的 assistant 消息数。 */
  messageCount: number;
}

function emptyUsage(): TenantTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalCost: 0,
    sessionCount: 0,
    messageCount: 0,
  };
}

function ledgerDedupeKeys(events: UsageLedgerEvent[]): Set<string> {
  return new Set(events.map((event) => usageMessageKey(event.sessionId, event.messageTimestamp)));
}

/** 累加 session 文件 usage；跳过 ledger 已记账的消息。 */
function accumulateSession(
  sessionId: string,
  filePath: string,
  acc: TenantTokenUsage,
  skipKeys: Set<string>,
): void {
  let entries: ReturnType<typeof getSessionEntries>;
  try {
    entries = getSessionEntries(filePath);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = (entry as SessionMessageEntry).message;
    if (!message || message.role !== "assistant") continue;
    const usage = message.usage;
    if (!usage) continue;
    const key = usageMessageKey(sessionId, message.timestamp);
    if (skipKeys.has(key)) continue;
    acc.inputTokens += usage.input ?? 0;
    acc.outputTokens += usage.output ?? 0;
    acc.cacheReadTokens += usage.cacheRead ?? 0;
    acc.cacheWriteTokens += usage.cacheWrite ?? 0;
    acc.totalCost += usage.cost?.total ?? 0;
    acc.messageCount += 1;
  }
}

/**
 * 聚合某 agentDir（租户）下的 token/cost。
 * @param agentDir 租户 agentDir（由 currentAgentDir() 提供）
 * @param sessions 可选：已查好的 session 列表，避免重复 listAllSessions
 */
export async function buildTenantTokenUsage(
  agentDir: string,
  sessions?: SessionInfo[],
): Promise<TenantTokenUsage> {
  const list = sessions ?? (await listAllSessions(agentDir));
  const ledgerEvents = readUsageLedgerEvents(agentDir);
  const skipKeys = ledgerDedupeKeys(ledgerEvents);

  const scanned = emptyUsage();
  scanned.sessionCount = list.length;
  for (const session of list) {
    if (session.path) accumulateSession(session.id, session.path, scanned, skipKeys);
  }

  if (ledgerEvents.length === 0) {
    return scanned;
  }

  return mergeTenantTokenUsage(scanned, aggregateUsageLedger(ledgerEvents));
}
