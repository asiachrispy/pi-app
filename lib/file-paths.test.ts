import { describe, expect, it } from "vitest";
import { resolveFilePathForOpen } from "./file-paths";

describe("resolveFilePathForOpen", () => {
  it("resolves a bare relative file name against cwd", () => {
    expect(resolveFilePathForOpen("login", "/Users/mk/project")).toBe("/Users/mk/project/login");
  });

  it("keeps absolute paths unchanged", () => {
    expect(resolveFilePathForOpen("/tmp/login", "/Users/mk/project")).toBe("/tmp/login");
  });

  it("keeps relative paths unchanged when cwd is missing", () => {
    expect(resolveFilePathForOpen("login")).toBe("login");
  });
});
