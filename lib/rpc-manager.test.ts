import { describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSession: vi.fn(),
  SessionManager: {},
}));

describe("AgentSessionWrapper", () => {
  it("subscribes to inner events and unsubscribes on destroy", async () => {
    vi.useFakeTimers();
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const unsubscribe = vi.fn();
    let subscribed: ((event: { type: string }) => void) | undefined;
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      subscribe: vi.fn((cb) => {
        subscribed = cb;
        return unsubscribe;
      }),
    };

    const wrapper = new AgentSessionWrapper(inner as never);
    const listener = vi.fn();
    wrapper.onEvent(listener);
    wrapper.start();
    subscribed?.({ type: "agent_start" });
    wrapper.destroy();

    expect(listener).toHaveBeenCalledWith({ type: "agent_start" });
    expect(unsubscribe).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("sends prompts without awaiting the long-running prompt promise", async () => {
    vi.useFakeTimers();
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const prompt = vi.fn(() => new Promise(() => undefined));
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      subscribe: vi.fn(() => vi.fn()),
      prompt,
    };
    const wrapper = new AgentSessionWrapper(inner as never);
    wrapper.start();

    await expect(wrapper.send({ type: "prompt", message: "hello" })).resolves.toBeNull();
    expect(prompt).toHaveBeenCalledWith("hello", undefined);
    wrapper.destroy();
    vi.useRealTimers();
  });
});
