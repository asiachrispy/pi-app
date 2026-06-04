import { describe, expect, it } from "vitest";
import { buildSharedConversationMessages } from "./shared-conversation";
import type { AgentMessage } from "./types";

describe("buildSharedConversationMessages", () => {
  it("keeps only public transcript content", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        model: "m",
        provider: "p",
        content: [
          { type: "thinking", thinking: "private chain" },
          { type: "toolCall", toolCallId: "tc1", toolName: "read", input: { path: "/Users/alice/secret.txt" } },
          { type: "text", text: "visible answer" },
        ],
        usage: {
          input: 1,
          output: 2,
          cacheRead: 0,
          cacheWrite: 0,
          cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
        },
      },
      {
        role: "toolResult",
        toolCallId: "tc1",
        content: [{ type: "text", text: "secret file contents" }],
      },
    ];

    const shared = buildSharedConversationMessages(messages, ["u1", "a1", "t1"]);

    expect(shared.entryIds).toEqual(["u1", "a1"]);
    expect(shared.messages).toHaveLength(2);
    expect(shared.messages[1]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "visible answer" }],
    });
    expect(JSON.stringify(shared)).not.toContain("secret");
    expect(JSON.stringify(shared)).not.toContain("toolCall");
    expect(JSON.stringify(shared)).not.toContain("usage");
  });
});
