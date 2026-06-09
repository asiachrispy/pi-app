import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTerminalManager,
  resetTerminalManagerForTests,
} from "./manager";
import { _resetTerminalSettingsCache } from "./settings";

beforeEach(() => {
  resetTerminalManagerForTests();
  _resetTerminalSettingsCache();
  vi.useRealTimers();
});

describe("TerminalManager.getOrCreate", () => {
  it("returns the same session object on repeat calls for the same cwd", () => {
    const mgr = getTerminalManager();
    const a = mgr.getOrCreate("/tmp/proj-a");
    const b = mgr.getOrCreate("/tmp/proj-a");
    expect(a).toBe(b);
  });

  it("returns different sessions for different cwds", () => {
    const mgr = getTerminalManager();
    const a = mgr.getOrCreate("/tmp/proj-a");
    const b = mgr.getOrCreate("/tmp/proj-b");
    expect(a).not.toBe(b);
    expect(a.cwd).toBe("/tmp/proj-a");
    expect(b.cwd).toBe("/tmp/proj-b");
  });

  it("starts a new session with empty buffer / history / no running process", () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-c");
    expect(s.buffer).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.historyIndex).toBe(-1);
    expect(s.runningProcess).toBeNull();
    expect(s.listeners.size).toBe(0);
  });
});

describe("TerminalManager.subscribe + emit", () => {
  it("fans out a 'line' event to all listeners", () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-d");
    const a: string[] = [];
    const b: string[] = [];
    mgr.subscribe(s, (e) => {
      if (e.type === "line") a.push(e.line.kind);
    });
    mgr.subscribe(s, (e) => {
      if (e.type === "line") b.push(e.line.kind);
    });
    mgr.emit(s, { type: "line", line: { kind: "info", text: "hi", ts: 1 } });
    expect(a).toEqual(["info"]);
    expect(b).toEqual(["info"]);
  });

  it("stops delivering to unsubscribed listeners", () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-e");
    const received: string[] = [];
    const unsub = mgr.subscribe(s, (e) => {
      if (e.type === "line") received.push(e.line.kind);
    });
    mgr.emit(s, { type: "line", line: { kind: "info", text: "1", ts: 1 } });
    unsub();
    mgr.emit(s, { type: "line", line: { kind: "info", text: "2", ts: 1 } });
    expect(received).toEqual(["info"]);
  });
});

describe("TerminalManager.startCommand", () => {
  it("spawns `echo hello` and emits a command line, output line, and exit line", async () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-spawn-1");
    const events: string[] = [];
    mgr.subscribe(s, (e) => {
      if (e.type === "line") events.push(e.line.kind);
    });
    await mgr.startCommand(s, "echo hello", false);
    // Wait for exit to be processed
    await new Promise((r) => setTimeout(r, 500));
    expect(events).toContain("command");
    expect(events).toContain("output");
    expect(events).toContain("exit");
    expect(s.runningProcess).toBeNull();
    const outLine = s.buffer.find((l) => l.kind === "output") as Extract<TerminalLine, { kind: "output" }> | undefined;
    expect(outLine?.text).toContain("hello");
    const exitLine = s.buffer.find((l) => l.kind === "exit") as Extract<TerminalLine, { kind: "exit" }> | undefined;
    expect(exitLine?.code).toBe(0);
  });

  it("rejects (returns slot-occupied) when a non-keep-running process is still alive", async () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-spawn-2");
    await mgr.startCommand(s, "sleep 5", false);
    // immediately try to start another; should be rejected
    const result = await mgr.startCommand(s, "echo second", false);
    expect(result).toEqual({ ok: false, reason: "slot_occupied" });
    // cleanup
    mgr.stop(s, "user");
  });

  it("kills the previous keep-running process when a new command is started", async () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-spawn-3");
    await mgr.startCommand(s, "sleep 30", true);
    expect(s.runningProcess?.isKeepRunning).toBe(true);
    const oldPid = s.runningProcess!.pid;
    // Start new command without await — startCommand is sync; the new spawn begins immediately
    const result = await mgr.startCommand(s, "echo replaced", false);
    expect(result.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 500));
    expect(s.runningProcess?.pid).not.toBe(oldPid);
    const info = s.buffer.find((l) => l.kind === "info") as Extract<TerminalLine, { kind: "info" }> | undefined;
    expect(info?.text).toBe("killed by new command");
  });

  it("killed child shows [exit null SIGTERM] in buffer", async () => {
    const mgr = getTerminalManager();
    const s = mgr.getOrCreate("/tmp/proj-spawn-4");
    await mgr.startCommand(s, "sleep 30", true);
    mgr.stop(s, "user");
    await new Promise((r) => setTimeout(r, 500));
    const exitLine = s.buffer.find((l) => l.kind === "exit") as Extract<TerminalLine, { kind: "exit" }> | undefined;
    expect(exitLine).toBeDefined();
    expect(exitLine?.signal).toBe("SIGTERM");
  });
});
