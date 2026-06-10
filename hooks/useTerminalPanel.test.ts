// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTerminalPanel } from "./useTerminalPanel";

describe("useTerminalPanel", () => {
  it("starts closed with the default height", () => {
    const { result } = renderHook(() => useTerminalPanel());
    expect(result.current.open).toBe(false);
    expect(result.current.height).toBe(0.4);
  });

  it("accepts a custom initial height", () => {
    const { result } = renderHook(() => useTerminalPanel(0.6));
    expect(result.current.height).toBe(0.6);
  });

  it("toggles open state", () => {
    const { result } = renderHook(() => useTerminalPanel());
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });

  it("close() forces closed regardless of current state", () => {
    const { result } = renderHook(() => useTerminalPanel());
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it("updates height via setHeight", () => {
    const { result } = renderHook(() => useTerminalPanel());
    act(() => result.current.setHeight(0.75));
    expect(result.current.height).toBe(0.75);
  });
});
