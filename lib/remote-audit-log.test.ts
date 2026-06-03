import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendRemoteAuditEvent,
  readRemoteAuditEvents,
  REMOTE_AUDIT_FILENAME,
} from "./remote-audit-log";

const agentDir = join(process.cwd(), ".tmp-remote-audit-test");

beforeEach(() => {
  process.env.PI_CODING_AGENT_DIR = agentDir;
  mkdirSync(agentDir, { recursive: true });
});

afterEach(() => {
  rmSync(agentDir, { recursive: true, force: true });
  delete process.env.PI_CODING_AGENT_DIR;
});

describe("remote-audit-log", () => {
  it("appends and reads events newest-first", () => {
    appendRemoteAuditEvent({ type: "remote_enabled" });
    appendRemoteAuditEvent({ type: "pairing_redeemed", sessionId: "s1" });

    const events = readRemoteAuditEvents(10);
    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("pairing_redeemed");
    expect(events[1]?.type).toBe("remote_enabled");

    const raw = readFileSync(join(agentDir, REMOTE_AUDIT_FILENAME), "utf8");
    expect(raw.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("returns empty list when file is missing", () => {
    expect(readRemoteAuditEvents()).toEqual([]);
  });
});
