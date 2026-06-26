import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggregateUsageLedger,
  appendUsageLedgerEvent,
  readUsageLedgerEvents,
  recordUsageFromAssistantMessage,
  USAGE_LEDGER_FILENAME,
  usageMessageKey,
} from "./record-usage";
import { runWithTenant } from "./tenant-context";

const agentDir = vi.hoisted(() => ({ value: "" }));

describe("record-usage", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-record-usage-"));
    mkdirSync(agentDir.value, { recursive: true });
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
  });

  it("appends usage events to token-usage.jsonl", () => {
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "s1",
      tenantId: "user-1",
      messageTimestamp: 100,
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 0.01,
    });

    const events = readUsageLedgerEvents(agentDir.value);
    expect(events).toHaveLength(1);
    expect(events[0]?.sessionId).toBe("s1");
    expect(readFileSync(join(agentDir.value, USAGE_LEDGER_FILENAME), "utf8").split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("aggregates ledger totals", () => {
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "s1",
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 1,
      cacheWriteTokens: 2,
      totalCost: 0.01,
    });
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "s2",
      inputTokens: 3,
      outputTokens: 4,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 0.02,
    });

    const agg = aggregateUsageLedger(readUsageLedgerEvents(agentDir.value));
    expect(agg.inputTokens).toBe(13);
    expect(agg.outputTokens).toBe(9);
    expect(agg.messageCount).toBe(2);
    expect(agg.sessionCount).toBe(2);
  });

  it("records from assistant message under tenant context", () => {
    runWithTenant({ tenantId: "user-9", agentDir: agentDir.value }, () => {
      recordUsageFromAssistantMessage("sid-1", {
        role: "assistant",
        content: [],
        model: "gpt-4",
        provider: "openai",
        timestamp: 42,
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.5 },
        },
      });
    });

    const [event] = readUsageLedgerEvents(agentDir.value);
    expect(event?.tenantId).toBe("user-9");
    expect(event?.inputTokens).toBe(100);
    expect(usageMessageKey("sid-1", 42)).toBe("sid-1:42");
  });
});
