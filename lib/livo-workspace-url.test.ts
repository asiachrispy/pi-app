import { describe, expect, it } from "vitest";
import { buildLivoWorkspaceResolvePath } from "./livo-workspace-url";

describe("buildLivoWorkspaceResolvePath", () => {
  it("keeps workspace and meeting in the resolve URL", () => {
    expect(buildLivoWorkspaceResolvePath("livo:user-1", "fileId_1")).toBe(
      "/api/livo/workspace/resolve?workspace=livo%3Auser-1&meeting=fileId_1"
    );
  });

  it("omits an empty meeting hint", () => {
    expect(buildLivoWorkspaceResolvePath("livo:user-1")).toBe(
      "/api/livo/workspace/resolve?workspace=livo%3Auser-1"
    );
  });
});
