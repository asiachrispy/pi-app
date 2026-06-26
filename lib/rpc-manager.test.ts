import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionManagerMock = vi.hoisted(() => ({
  open: vi.fn(),
  create: vi.fn(),
}));
const agentSessionMock = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
}));
const tenantMock = vi.hoisted(() => ({
  currentAgentDir: vi.fn(() => "/tmp/global-agent"),
  currentSessionDir: vi.fn(() => undefined as string | undefined),
}));
const resourceLoaderMock = vi.hoisted(() => ({
  createAgentResourceLoader: vi.fn(async () => ({
    getExtensions: () => ({ extensions: [] }),
  })),
}));
const modelConfigMock = vi.hoisted(() => ({
  createGlobalModelConfig: vi.fn(() => ({
    authStorage: { source: "global-auth" },
    modelRegistry: { source: "global-models" },
  })),
  lookupModel: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSession: agentSessionMock.createAgentSession,
  SessionManager: sessionManagerMock,
}));

vi.mock("@/lib/agent-resource-loader", () => ({
  createAgentResourceLoader: resourceLoaderMock.createAgentResourceLoader,
}));

vi.mock("@/lib/livo/tenant-gate", () => ({
  currentAgentDir: tenantMock.currentAgentDir,
  currentSessionDir: tenantMock.currentSessionDir,
}));

vi.mock("./resolve-model", () => ({
  createGlobalModelConfig: modelConfigMock.createGlobalModelConfig,
  lookupModel: modelConfigMock.lookupModel,
}));

describe("AgentSessionWrapper", () => {
  beforeEach(() => {
    sessionManagerMock.open.mockReset();
    sessionManagerMock.create.mockReset();
  });

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

  it("sends get_session_stats through inner session", async () => {
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const stats = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      userMessages: 1,
      assistantMessages: 1,
      toolCalls: 0,
      toolResults: 0,
      totalMessages: 2,
      tokens: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, total: 15 },
      cost: 0.001,
    };
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      subscribe: vi.fn(() => vi.fn()),
      getSessionStats: vi.fn(() => stats),
    };
    const wrapper = new AgentSessionWrapper(inner as never);
    await expect(wrapper.send({ type: "get_session_stats" })).resolves.toEqual(stats);
  });

  it("exports html via inner exportToHtml", async () => {
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const exportToHtml = vi.fn(async () => "/tmp/session.html");
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      subscribe: vi.fn(() => vi.fn()),
      exportToHtml,
    };
    const wrapper = new AgentSessionWrapper(inner as never);
    const result = await wrapper.send({ type: "export_html" }) as { path: string; filename: string };
    expect(result.path).toBe("/tmp/session.html");
    expect(result.filename).toBe("session.html");
    expect(exportToHtml).toHaveBeenCalledOnce();
  });

  it("returns slash commands from inner session sources", async () => {
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      subscribe: vi.fn(() => vi.fn()),
      extensionRunner: {
        getRegisteredCommands: () => [{ invocationName: "foo", description: "Foo cmd" }],
      },
      promptTemplates: [{ name: "bar", description: "Bar template" }],
      resourceLoader: {
        getSkills: () => ({ skills: [{ name: "baz", description: "Baz skill" }] }),
      },
    };
    const wrapper = new AgentSessionWrapper(inner as never);
    const result = await wrapper.send({ type: "get_commands" }) as { commands: Array<{ name: string }> };
    expect(result.commands.map((c) => c.name)).toEqual(["foo", "bar", "skill:baz"]);
  });

  it("passes summarize to inner.navigateTree", async () => {
    const navigateTree = vi.fn(async () => ({ cancelled: false }));
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/session.jsonl",
      subscribe: vi.fn(() => vi.fn()),
      navigateTree,
    };
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const wrapper = new AgentSessionWrapper(inner as never);
    const result = await wrapper.send({ type: "navigate_tree", targetId: "leaf-2", summarize: true });
    expect(navigateTree).toHaveBeenCalledWith("leaf-2", { summarize: true });
    expect(result).toEqual({ cancelled: false });
  });

  it("destroys the wrapper after creating a fork", async () => {
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const unsubscribe = vi.fn();
    const sourceManager = {
      isPersisted: () => true,
      getSessionDir: () => "/tmp/sessions",
      getEntry: vi.fn(() => ({ id: "entry-1", parentId: "parent-1" })),
    };
    sessionManagerMock.open
      .mockReturnValueOnce({
        createBranchedSession: vi.fn(() => "/tmp/sessions/fork.jsonl"),
      })
      .mockReturnValueOnce({
        getSessionId: () => "forked-session",
      });
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/sessions/source.jsonl",
      sessionManager: sourceManager,
      subscribe: vi.fn(() => unsubscribe),
    };
    const wrapper = new AgentSessionWrapper(inner as never);
    wrapper.start();

    await expect(wrapper.send({ type: "fork", entryId: "entry-1" })).resolves.toEqual({
      cancelled: false,
      newSessionId: "forked-session",
    });

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(sessionManagerMock.open).toHaveBeenNthCalledWith(1, "/tmp/sessions/source.jsonl", "/tmp/sessions");
    expect(sessionManagerMock.open).toHaveBeenNthCalledWith(2, "/tmp/sessions/fork.jsonl", "/tmp/sessions");
    await expect(wrapper.send({ type: "get_session_stats" })).rejects.toThrow("Session is closed");
  });

  it("destroys the wrapper after cloning the active branch", async () => {
    const { AgentSessionWrapper } = await import("./rpc-manager");
    const unsubscribe = vi.fn();
    const sourceManager = {
      isPersisted: () => true,
      getSessionDir: () => "/tmp/sessions",
    };
    sessionManagerMock.open
      .mockReturnValueOnce({
        getLeafId: () => "leaf-1",
        createBranchedSession: vi.fn(() => "/tmp/sessions/clone.jsonl"),
      })
      .mockReturnValueOnce({
        getSessionId: () => "cloned-session",
      });
    const inner = {
      sessionId: "s1",
      sessionFile: "/tmp/sessions/source.jsonl",
      sessionManager: sourceManager,
      subscribe: vi.fn(() => unsubscribe),
    };
    const wrapper = new AgentSessionWrapper(inner as never);
    wrapper.start();

    await expect(wrapper.send({ type: "clone" })).resolves.toEqual({
      cancelled: false,
      newSessionId: "cloned-session",
    });

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(sessionManagerMock.open).toHaveBeenNthCalledWith(1, "/tmp/sessions/source.jsonl", "/tmp/sessions");
    expect(sessionManagerMock.open).toHaveBeenNthCalledWith(2, "/tmp/sessions/clone.jsonl", "/tmp/sessions");
    await expect(wrapper.send({ type: "get_session_stats" })).rejects.toThrow("Session is closed");
  });
});

describe("startRpcSession", () => {
  beforeEach(() => {
    agentSessionMock.createAgentSession.mockReset();
    sessionManagerMock.create.mockReset();
    tenantMock.currentAgentDir.mockReset();
    tenantMock.currentSessionDir.mockReset();
    resourceLoaderMock.createAgentResourceLoader.mockClear();
    modelConfigMock.createGlobalModelConfig.mockClear();
    tenantMock.currentAgentDir.mockReturnValue("/tmp/livo/user-1/.pi-agent");
    tenantMock.currentSessionDir.mockReturnValue("/tmp/livo/user-1/.pi-agent/sessions");
    sessionManagerMock.create.mockReturnValue({ getCwd: () => "/tmp/livo/user-1" });
    agentSessionMock.createAgentSession.mockResolvedValue({
      session: {
        sessionId: "session-1",
        sessionFile: "/tmp/livo/user-1/.pi-agent/sessions/session-1.jsonl",
        subscribe: vi.fn(() => vi.fn()),
        setAutoCompactionEnabled: vi.fn(),
        setAutoRetryEnabled: vi.fn(),
        setActiveToolsByName: vi.fn(),
      },
    });
  });

  it("uses tenant dirs for sessions/resources but global auth and model registry", async () => {
    const { startRpcSession } = await import("./rpc-manager");

    await startRpcSession("__new__1", "", "/tmp/livo/user-1", ["read"]);

    expect(sessionManagerMock.create).toHaveBeenCalledWith(
      "/tmp/livo/user-1",
      "/tmp/livo/user-1/.pi-agent/sessions",
    );
    expect(resourceLoaderMock.createAgentResourceLoader).toHaveBeenCalledWith(
      "/tmp/livo/user-1",
      "/tmp/livo/user-1/.pi-agent",
    );
    expect(modelConfigMock.createGlobalModelConfig).toHaveBeenCalledOnce();
    expect(agentSessionMock.createAgentSession).toHaveBeenCalledWith(expect.objectContaining({
      agentDir: "/tmp/livo/user-1/.pi-agent",
      authStorage: { source: "global-auth" },
      modelRegistry: { source: "global-models" },
    }));
  });
});
