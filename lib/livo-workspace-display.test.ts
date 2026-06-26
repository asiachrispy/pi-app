import { describe, expect, it } from "vitest";
import { formatLivoWorkspacePath } from "./livo-workspace-display";

describe("formatLivoWorkspacePath", () => {
  it("uses user-facing livo meeting labels instead of filesystem labels", () => {
    expect(formatLivoWorkspacePath("/data/pi-agent/workspaces/livo/users/0123456789abcdef")).toBe("Livo 会议任务");
    expect(formatLivoWorkspacePath("/data/pi-agent/workspaces/livo/users/0123456789abcdef/meetings/fileId_1")).toBe("Livo 会议任务");
  });

  it("keeps the existing short path fallback for non-livo cwd", () => {
    expect(formatLivoWorkspacePath("/Users/mk/project/app", "/Users/mk")).toBe("…/project/app");
  });
});
