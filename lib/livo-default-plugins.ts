import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@/lib/agent-dir";

export const LIVO_DEFAULT_PI_PACKAGES = [
  "pi-skills-sh",
  "pi-mcp-extension",
  "pi-search-hub",
  "pi-agent-browser-native",
] as const;

export function defaultLivoPluginPaths(agentDir = getAgentDir()): string[] {
  const root = join(agentDir, "npm", "node_modules");
  return LIVO_DEFAULT_PI_PACKAGES
    .map((name) => join(root, name))
    .filter((path) => existsSync(path));
}
