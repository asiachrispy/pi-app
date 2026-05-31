import { describe, expect, it } from "vitest";
import {
  filePathFromSegments,
  isPathAllowed,
  parseByteRange,
} from "./file-access";

describe("file access helpers", () => {
  it("reconstructs POSIX absolute paths from route segments", () => {
    expect(filePathFromSegments(["Users", "mk", "project", "README.md"])).toBe("/Users/mk/project/README.md");
  });

  it("preserves Windows absolute paths encoded as route segments", () => {
    expect(filePathFromSegments(["C:", "Users", "mk", "project", "file.txt"])).toBe("C:/Users/mk/project/file.txt");
  });

  it("allows exact roots and descendants but rejects sibling prefix tricks", () => {
    const roots = new Set(["/Users/mk/project"]);

    expect(isPathAllowed("/Users/mk/project", roots)).toBe(true);
    expect(isPathAllowed("/Users/mk/project/src/app.ts", roots)).toBe(true);
    expect(isPathAllowed("/Users/mk/project-evasive/secret.txt", roots)).toBe(false);
  });

  it("parses regular and suffix byte ranges", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
    expect(parseByteRange("bytes=90-999", 100)).toEqual({ start: 90, end: 99 });
  });

  it("reports invalid or unsatisfiable byte ranges", () => {
    expect(parseByteRange("items=1-2", 100)).toEqual({ error: "invalid" });
    expect(parseByteRange("bytes=50-40", 100)).toEqual({ error: "unsatisfiable" });
    expect(parseByteRange("bytes=100-120", 100)).toEqual({ error: "unsatisfiable" });
  });
});
