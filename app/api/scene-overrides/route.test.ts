import { describe, it, expect, vi } from "vitest";

const { readMock, authMock } = vi.hoisted(() => ({
  readMock: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock("@/lib/scene-overrides", () => ({
  readAllSceneOverrides: readMock,
  upsertSceneOverride: vi.fn(),
  clearSceneOverride: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: authMock,
}));

describe("GET /api/scene-overrides", () => {
  it("returns 200 with the override map", async () => {
    readMock.mockReset().mockReturnValueOnce({
      "report-generation": { outputStyle: "Markdown" },
    });
    authMock.mockReset().mockReturnValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://127.0.0.1/api/scene-overrides"));
    const body = (await res.json()) as {
      overrides?: Record<string, { outputStyle?: string }>;
    };
    expect(res.status).toBe(200);
    expect(body.overrides).toEqual({
      "report-generation": { outputStyle: "Markdown" },
    });
  });

  it("returns 500 when the storage layer throws", async () => {
    readMock.mockReset().mockImplementationOnce(() => {
      throw new Error("disk failure");
    });
    authMock.mockReset().mockReturnValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://127.0.0.1/api/scene-overrides"));
    const body = (await res.json()) as { error?: string };
    expect(res.status).toBe(500);
    expect(body.error).toMatch(/Failed to read scene overrides/);
    expect(body.error).toMatch(/disk failure/);
  });
});
