import { describe, expect, it, vi } from "vitest";

const loaderOptions = vi.hoisted(() => ({
  last: undefined as unknown,
  reload: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  DefaultResourceLoader: vi.fn(function DefaultResourceLoader(options: unknown) {
    loaderOptions.last = options;
    return { reload: loaderOptions.reload };
  }),
  SettingsManager: {
    create: vi.fn(() => ({ settings: true })),
  },
}));

vi.mock("@/lib/livo-default-plugins", () => ({
  defaultLivoPluginPaths: vi.fn(() => ["/global/pi-skills-sh"]),
}));

vi.mock("@/lib/session-reader", () => ({
  isTenantAgentDir: vi.fn((agentDir: string) => agentDir.includes("/users/")),
}));

describe("createAgentResourceLoader", () => {
  it("adds global default plugins for Livo tenant agent dirs", async () => {
    const { createAgentResourceLoader } = await import("./agent-resource-loader");

    await createAgentResourceLoader("/workspace", "/data/pi-agent/workspaces/livo/users/u1/.pi-agent");

    expect(loaderOptions.last).toMatchObject({
      additionalExtensionPaths: ["/global/pi-skills-sh"],
    });
  });

  it("leaves non-tenant resource loading unchanged", async () => {
    const { createAgentResourceLoader } = await import("./agent-resource-loader");

    await createAgentResourceLoader("/workspace", "/Users/mk/.pi/agent");

    expect(loaderOptions.last).not.toHaveProperty("additionalExtensionPaths");
  });
});
