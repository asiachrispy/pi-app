// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAgentNewCommand } from "./agent-client";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("sendAgentNewCommand", () => {
  it("POSTs to /api/agent/new with the JSON-encoded body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(200, { success: true, sessionId: "s1", data: null }),
    );

    const result = await sendAgentNewCommand({ cwd: "/tmp", type: "ensure_session" });

    expect(result).toEqual({ sessionId: "s1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cwd: "/tmp", type: "ensure_session" }),
    });
  });

  it("throws the server's body.error message instead of a bare HTTP status", async () => {
    // Regression: previously `useAgentSession.ts` did
    //   if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // which swallowed the server's actual error reason. Server returned
    // { error: "Error: Unsupported command: ensure_session" } but the user
    // only saw "HTTP 500" — useless for debugging.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(500, { error: "Error: Unsupported command: ensure_session" }),
    );

    await expect(
      sendAgentNewCommand({ cwd: "/tmp", type: "ensure_session" }),
    ).rejects.toThrow("Unsupported command: ensure_session");
  });

  it("falls back to HTTP status when server omits the error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(503, {}),
    );

    await expect(
      sendAgentNewCommand({ cwd: "/tmp", type: "ensure_session" }),
    ).rejects.toThrow(/HTTP 503/);
  });
});