import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "components/AppShell.tsx"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");

describe("AppShell Livo workspace deep link", () => {
  it("accepts a server-provided Livo default cwd for plain /app refreshes", () => {
    expect(source).toContain("initialDefaultCwd?: string | null");
    expect(source).toContain("useState<string | null>(initialDefaultCwd)");
    expect(pageSource).toContain("<AppShell initialDefaultCwd={initialDefaultCwd} />");
  });

  it("opens the chat view after resolving workspace and meeting params", () => {
    const resolveEffect = source.slice(
      source.indexOf("fetch(buildLivoWorkspaceResolvePath"),
      source.indexOf(".catch((error)", source.indexOf("fetch(buildLivoWorkspaceResolvePath")),
    );

    expect(resolveEffect).toContain("setNewSessionCwd(data.cwd)");
    expect(resolveEffect).toContain('setWorkbenchView("chat")');
  });

  it("restores a deep-linked session before the sidebar list catches up", () => {
    expect(source).toContain("void fetchSessionInfo(initialSessionId)");
    expect(source).toContain("handleSelectSession(info, true)");
    expect(source).toContain("initialSessionRestored ? null : initialSessionId");
  });
});
