import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "components/AppShell.tsx"), "utf8");

describe("AppShell Livo workspace deep link", () => {
  it("opens the chat view after resolving workspace and meeting params", () => {
    const resolveEffect = source.slice(
      source.indexOf("fetch(buildLivoWorkspaceResolvePath"),
      source.indexOf(".catch((error)", source.indexOf("fetch(buildLivoWorkspaceResolvePath")),
    );

    expect(resolveEffect).toContain("setNewSessionCwd(data.cwd)");
    expect(resolveEffect).toContain('setWorkbenchView("chat")');
  });
});
