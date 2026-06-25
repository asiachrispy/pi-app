import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyLivoPiStatus, shouldNotifyLivo } from "./livo-status-callback";

const originalEnv = process.env;

describe("livo-status-callback", () => {
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("requires Livo metadata before notifying", () => {
    expect(
      shouldNotifyLivo({
        userId: "user-1",
        meetingId: "fileId_1",
        piSessionId: "session-1",
        status: "running",
      })
    ).toBe(true);
    expect(
      shouldNotifyLivo({
        userId: "user-1",
        meetingId: "",
        piSessionId: "session-1",
        status: "running",
      })
    ).toBe(false);
  });

  it("posts status callback with the shared remote token", async () => {
    process.env = {
      ...originalEnv,
      PI_LIVO_BASE_URL: "https://livo.example.com/",
      PI_WEB_REMOTE_TOKEN: "server-token",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const notified = await notifyLivoPiStatus({
      userId: "user-1",
      meetingId: "fileId_1",
      piSessionId: "session-1",
      status: "running",
      items: [{ todoId: "todo_a", status: "running" }],
    });

    expect(notified).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://livo.example.com/pi-agent/callbacks/status",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer server-token",
        },
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userId: "user-1",
      meetingId: "fileId_1",
      piSessionId: "session-1",
      status: "running",
      items: [{ todoId: "todo_a", status: "running" }],
    });
  });

  it("skips callback when env or metadata is missing", async () => {
    process.env = { ...originalEnv, PI_LIVO_BASE_URL: "", PI_WEB_REMOTE_TOKEN: "" };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      notifyLivoPiStatus({
        userId: "user-1",
        meetingId: "fileId_1",
        piSessionId: "session-1",
        status: "running",
      })
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
