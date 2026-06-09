// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("@/hooks/useTerminal", () => ({
  useTerminal: vi.fn(),
}));

import { useTerminal } from "@/hooks/useTerminal";
import { TerminalPanel } from "./TerminalPanel";

const mockUseTerminal = useTerminal as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockUseTerminal.mockReset();
});

describe("TerminalPanel", () => {
  it("renders nothing visible when open is false", () => {
    mockUseTerminal.mockReturnValue({
      lines: [], history: [], running: null, isLoading: false, error: null,
      submit: vi.fn(), stop: vi.fn(), clear: vi.fn(),
    });
    const { container } = render(
      <TerminalPanel cwd="/tmp/proj" open={false} height={0.4} onClose={vi.fn()} onHeightChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).style.display).toBe("none");
  });

  it("renders status bar with cwd when open", () => {
    mockUseTerminal.mockReturnValue({
      lines: [], history: [], running: null, isLoading: false, error: null,
      submit: vi.fn(), stop: vi.fn(), clear: vi.fn(),
    });
    const { container } = render(
      <TerminalPanel cwd="/tmp/proj" open={true} height={0.4} onClose={vi.fn()} onHeightChange={vi.fn()} />,
    );
    // The status bar shows a 📟 glyph plus the last 2 components of the cwd
    expect(container.textContent).toMatch(/Terminal/);
    expect(container.textContent).toMatch(/tmp\/proj/);
  });

  it("shows Stop button when running and keepRunning=true; click triggers stop()", () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    mockUseTerminal.mockReturnValue({
      lines: [], history: [],
      running: { pid: 12345, command: "tail -f", startedAt: Date.now(), isKeepRunning: true },
      isLoading: false, error: null,
      submit: vi.fn(), stop, clear: vi.fn(),
    });
    const { container } = render(
      <TerminalPanel cwd="/tmp/proj" open={true} height={0.4} onClose={vi.fn()} onHeightChange={vi.fn()} />,
    );
    const stopBtn = container.querySelector(".terminal-status-stop") as HTMLButtonElement;
    expect(stopBtn).toBeTruthy();
    fireEvent.click(stopBtn);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("input is disabled when running and not keepRunning", () => {
    mockUseTerminal.mockReturnValue({
      lines: [], history: [],
      running: { pid: 1, command: "x", startedAt: Date.now(), isKeepRunning: false },
      isLoading: false, error: null,
      submit: vi.fn(), stop: vi.fn(), clear: vi.fn(),
    });
    const { container } = render(
      <TerminalPanel cwd="/tmp/proj" open={true} height={0.4} onClose={vi.fn()} onHeightChange={vi.fn()} />,
    );
    const input = container.querySelector(".terminal-input-field") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
