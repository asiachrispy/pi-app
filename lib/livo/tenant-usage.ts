import { getSessionEntries, listAllSessions } from "@/lib/session-reader";
import type { SessionInfo, SessionMessageEntry } from "@/lib/types";

/**
 * Per-tenant token / cost 聚合（方案二 Step 5）。
 *
 * 数据来源：每条 assistant 消息自带 usage（input/output/cache token + cost）。
 * 遍历该租户 agentDir 下所有 session 的 assistant 消息累加。
 *
 * 隔离：调用方传入的 agentDir 决定遍历范围——租户 agentDir 经 listAllSessions
 * 只列该租户单层 sessions，天然不串其他租户。
 *
 * 本期只展示、不拦截（无预算 enforcement）。遍历全部 session 全文较重，但 usage
 * 接口非高频，可接受；将来对外开放时换 DB 增量记账（路线 3 接缝 recordUsage）。
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

/** 累加单个 session 文件里所有 assistant 消息的 usage。 */
function accumulateSession(filePath: string, acc: TenantTokenUsage): void {
  let entries: ReturnType<typeof getSessionEntries>;
  try {
    entries = getSessionEntries(filePath);
  } catch {
    return; // 单个 session 读失败不影响整体
  }
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = (entry as SessionMessageEntry).message;
    if (!message || message.role !== "assistant") continue;
    const usage = message.usage;
    if (!usage) continue;
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
  const acc = emptyUsage();
  acc.sessionCount = list.length;
  for (const s of list) {
    if (s.path) accumulateSession(s.path, acc);
  }
  return acc;
}
