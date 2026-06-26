import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendUsageLedgerEvent } from "./record-usage";
import { checkBudget, isBudgetWarnOnly, resolveTenantBudgetUsd, warnIfBudgetExceeded } from "./check-budget";

const agentDir = vi.hoisted(() => ({ value: "" }));

vi.mock("@/lib/session-reader", () => ({
  listAllSessions: vi.fn(async () => []),
  getSessionEntries: vi.fn(() => []),
}));

describe("check-budget", () => {
  beforeEach(() => {
    agentDir.value = mkdtempSync(join(tmpdir(), "pi-check-budget-"));
    mkdirSync(agentDir.value, { recursive: true });
    vi.stubEnv("PI_LIVO_TENANT_BUDGET_USD", "1.00");
    vi.stubEnv("PI_LIVO_BUDGET_ENFORCE", "");
  });

  afterEach(() => {
    rmSync(agentDir.value, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("parses tenant budget env", () => {
    expect(resolveTenantBudgetUsd()).toBe(1);
    vi.stubEnv("PI_LIVO_TENANT_BUDGET_USD", "");
    expect(resolveTenantBudgetUsd()).toBeNull();
  });

  it("defaults to warn-only mode", () => {
    expect(isBudgetWarnOnly()).toBe(true);
    vi.stubEnv("PI_LIVO_BUDGET_ENFORCE", "1");
    expect(isBudgetWarnOnly()).toBe(false);
  });

  it("detects exceeded budget from ledger totals", async () => {
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "s1",
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 1.5,
    });

    const result = await checkBudget(agentDir.value);
    expect(result.exceeded).toBe(true);
    expect(result.warnOnly).toBe(true);
    expect(result.message).toMatch(/exceeded/i);
  });

  it("warnIfBudgetExceeded logs but does not throw", async () => {
    appendUsageLedgerEvent(agentDir.value, {
      sessionId: "s1",
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: 2,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await warnIfBudgetExceeded(agentDir.value, { sessionId: "s1" });
    expect(result?.exceeded).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
