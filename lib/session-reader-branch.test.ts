import { describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "./types";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getAgentDir: () => "/tmp/pi-agent",
  SessionManager: {},
  buildSessionContext: () => ({
    messages: [],
    thinkingLevel: "medium",
    model: { provider: "p", modelId: "m" },
  }),
}));

describe("session-reader branch summary", () => {
  it("maps branchSummary to timelineSummary in context", async () => {
    const { buildSessionContext } = await import("./session-reader");
    const entries = [
      { type: "message", id: "u0", parentId: null, timestamp: "2026-01-01T00:00:00Z", message: { role: "user", content: "earlier" } },
      {
        type: "branch_summary",
        id: "bs1",
        parentId: "u0",
        timestamp: "2026-01-01T00:00:01Z",
        summary: "left branch context",
        fromId: "other",
      },
      { type: "message", id: "u1", parentId: "bs1", timestamp: "2026-01-01T00:00:02Z", message: { role: "user", content: "kept" } },
    ] as SessionEntry[];

    const context = buildSessionContext(entries, "u1");

    expect(context.messages[1]).toMatchObject({
      role: "timelineSummary",
      kind: "branch",
      summary: "left branch context",
    });
  });
});
