// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n/provider";
import { ChatWindow } from "./ChatWindow";

const useAgentSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAgentSession", () => ({
  useAgentSession: useAgentSessionMock,
}));

vi.mock("./MessageView", () => ({
  MessageView: () => null,
}));

vi.mock("./ChatMinimap", () => ({
  ChatMinimap: () => null,
  useMessageRefs: () => ({ current: [] }),
}));

vi.mock("@/hooks/useAudio", () => ({
  useAudio: () => ({
    soundEnabled: false,
    onSoundToggle: () => undefined,
    playDoneSound: () => undefined,
  }),
}));

vi.mock("@/hooks/useDragDrop", () => ({
  useDragDrop: () => ({
    isDragOver: false,
    handleDragEnter: () => undefined,
    handleDragOver: () => undefined,
    handleDragLeave: () => undefined,
    handleDrop: () => undefined,
  }),
}));

afterEach(() => {
  cleanup();
  useAgentSessionMock.mockReset();
});

function renderWindowWithCommands() {
  useAgentSessionMock.mockReturnValue({
    loading: false,
    error: null,
    messages: [],
    entryIds: [],
    streamState: { isStreaming: false, streamingMessage: null },
    agentRunning: false,
    modelNames: {},
    modelList: [],
    modelThinkingLevels: {},
    modelThinkingLevelMaps: {},
    toolPreset: "default",
    thinkingLevel: "auto",
    retryInfo: null,
    contextUsage: null,
    forkingEntryId: null,
    isCompacting: false,
    compactError: null,
    displayModel: null,
    sessionStats: null,
    agentPhase: null,
    isNew: true,
    messagesEndRef: { current: null },
    scrollContainerRef: { current: null },
    lastUserMsgRef: { current: null },
    handleSend: () => undefined,
    handleAbort: () => undefined,
    handleFork: () => undefined,
    handleNavigate: () => undefined,
    handleModelChange: () => undefined,
    handleCompact: () => undefined,
    handleSteer: () => undefined,
    handleFollowUp: () => undefined,
    handleAbortCompaction: () => undefined,
    handleToolPresetChange: () => undefined,
    handleThinkingLevelChange: () => undefined,
    handleAgentEventRef: { current: null },
    slashCommands: [
      { name: "skill:livo-todo", description: "Run a Livo todo", source: "skill" },
    ],
  });

  return render(
    <LocaleProvider>
      <ChatWindow session={null} newSessionCwd="/workspace/livo/user-1" />
    </LocaleProvider>,
  );
}

describe("ChatWindow slash commands", () => {
  it("passes loaded slash commands to the input menu", () => {
    const { container } = renderWindowWithCommands();
    const input = container.querySelector("textarea");
    expect(input).toBeTruthy();

    fireEvent.change(input as HTMLTextAreaElement, {
      target: { value: "/", selectionStart: 1 },
    });

    expect(screen.queryByText("/skill:livo-todo")).toBeTruthy();
  });
});
