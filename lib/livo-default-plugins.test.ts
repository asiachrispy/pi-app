import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { defaultLivoPluginPaths, LIVO_DEFAULT_PI_PACKAGES } from "./livo-default-plugins";

describe("defaultLivoPluginPaths", () => {
  it("returns installed global default Pi plugin package paths", () => {
    const agentDir = join(tmpdir(), `pi-default-plugins-${process.pid}`);
    const packageRoot = join(agentDir, "npm", "node_modules");
    mkdirSync(join(packageRoot, "pi-skills-sh"), { recursive: true });
    mkdirSync(join(packageRoot, "pi-search-hub"), { recursive: true });

    try {
      expect(defaultLivoPluginPaths(agentDir)).toEqual([
        join(packageRoot, "pi-skills-sh"),
        join(packageRoot, "pi-search-hub"),
      ]);
      expect(LIVO_DEFAULT_PI_PACKAGES).toContain("pi-agent-browser-native");
    } finally {
      rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
