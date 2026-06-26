import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendUsageLedgerEvent } from "./record-usage";
import { buildTenantTokenUsage } from "./tenant-usage";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/session-reader", () => ({
  listAllSessions: vi.fn(async () => [
    {
      id: "session-1",
      cwd: "/tmp/project",
      path: "session-file.jsonl",
      created: "",
      modified: "",
      messageCount: 1,
      firstMessage: "hi",
    },
  ]),
  getSessionEntries: vi.fn(() => [
    {
      type: "message",
      message: {
        role: "assistant",
        content: [],
        model: "gpt-4",
        provider: "openai",
        timestamp: 100,
        usage: {
          input: 20,
          output: 10,
          cacheRead: 0,
          cacheWrite: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.2 },
        },
      },
    },
  ]),
}));

describe("buildTenantTokenUsage", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-tenant-usage-"));
    mkdirSync(agentDir.value, { recursive: true });
    writeFileSync(join(agentDir.value, "session-file.jsonl"), "{}", "utf8");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
  });

  it("scans session files when ledger is empty", async () => {
    const usage = await buildTenantTokenUsage(agentDir.value);
    expect(usage.inputTokens).toBe(20);
    expect(usage.outputTokens).toBe(10);
    expect(usage.messageCount).toBe(1);
  });

  it("merges ledger and skips duplicate session messages", async () => {
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "session-1",
      messageTimestamp: 100,
      inputTokens: 20,
      outputTokens: 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 0.2,
    });
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "session-1",
      messageTimestamp: 200,
      inputTokens: 5,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 0.05,
    });

    const usage = await buildTenantTokenUsage(agentDir.value);
    expect(usage.inputTokens).toBe(25);
    expect(usage.outputTokens).toBe(15);
    expect(usage.messageCount).toBe(2);
  });
});
