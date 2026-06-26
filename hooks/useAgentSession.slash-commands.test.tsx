// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useAgentSession } from "./useAgentSession";

const agentClientMock = vi.hoisted(() => ({
  sendAgentCommand: vi.fn(),
}));

vi.mock("@/lib/agent-client", () => ({
  sendAgentCommand: agentClientMock.sendAgentCommand,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  agentClientMock.sendAgentCommand.mockReset();
});

function HookProbe(props: Parameters<typeof useAgentSession>[0]) {
  const state = useAgentSession(props);
  return <div data-commands={state.slashCommands.map((cmd) => cmd.name).join(",")} />;
}

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("useAgentSession slash commands", () => {
  it("loads commands from an existing session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/sessions/s1")) {
        return okJson({
          sessionId: "s1",
          filePath: "/tmp/s1.jsonl",
          tree: [],
          leafId: null,
          context: { messages: [], entryIds: [], thinkingLevel: "auto", model: null },
          agentState: { running: false },
        });
      }
      if (url.includes("/api/models")) {
        return okJson({ models: {}, modelList: [] });
      }
      return okJson({});
    });
    agentClientMock.sendAgentCommand.mockResolvedValue({
      commands: [{ name: "skill:livo-todo", source: "skill" }],
    });

    const { container } = render(
      <HookProbe
        session={{
          id: "s1",
          path: "/tmp/s1.jsonl",
          cwd: "/workspace/livo/user-1",
          created: "2026-06-26T00:00:00.000Z",
          modified: "2026-06-26T00:00:00.000Z",
          messageCount: 0,
          firstMessage: "",
        }}
        newSessionCwd={null}
      />,
    );

    await waitFor(() => {
      expect(container.firstElementChild?.getAttribute("data-commands")).toBe("skill:livo-todo");
    });
    expect(agentClientMock.sendAgentCommand).toHaveBeenCalledWith("s1", { type: "get_commands" });
  });

  it("loads workspace skill commands for an empty new session", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/slash-commands")) {
        expect(url).toContain("cwd=%2Fworkspace%2Flivo%2Fuser-1");
        return okJson({ commands: [{ name: "skill:new-session", source: "skill" }] });
      }
      if (url.includes("/api/models")) {
        return okJson({ models: {}, modelList: [] });
      }
      return okJson({});
    });

    const { container } = render(
      <HookProbe session={null} newSessionCwd="/workspace/livo/user-1" />,
    );

    await waitFor(() => {
      expect(container.firstElementChild?.getAttribute("data-commands")).toBe("skill:new-session");
    });
  });
});
