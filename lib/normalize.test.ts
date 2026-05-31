import { describe, expect, it } from "vitest";
import { normalizeToolCalls } from "./normalize";
import type { AgentMessage } from "./types";

describe("normalizeToolCalls", () => {
  it("normalizes persisted pi toolCall blocks to UI field names", () => {
    const message = {
      role: "assistant",
      model: "m",
      provider: "p",
      content: [
        { type: "text", text: "hello" },
        { type: "toolCall", id: "call-1", name: "read", arguments: { path: "README.md" } },
      ],
    } as unknown as AgentMessage;

    expect(normalizeToolCalls(message)).toMatchObject({
      content: [
        { type: "text", text: "hello" },
        { type: "toolCall", toolCallId: "call-1", toolName: "read", input: { path: "README.md" } },
      ],
    });
  });
});
