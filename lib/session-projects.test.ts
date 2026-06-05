import { describe, expect, it } from "vitest";
import { getProjectCwds } from "./session-projects";

describe("getProjectCwds", () => {
  it("returns every project cwd sorted by latest activity", () => {
    const sessions = Array.from({ length: 7 }, (_, index) => ({
      cwd: `/project-${index + 1}`,
      modified: `2026-06-05T10:0${index}:00.000Z`,
    }));

    expect(getProjectCwds(sessions)).toEqual([
      "/project-7",
      "/project-6",
      "/project-5",
      "/project-4",
      "/project-3",
      "/project-2",
      "/project-1",
    ]);
  });

  it("uses the newest session when multiple sessions share a cwd", () => {
    expect(getProjectCwds([
      { cwd: "/older", modified: "2026-06-05T10:00:00.000Z" },
      { cwd: "/shared", modified: "2026-06-05T09:00:00.000Z" },
      { cwd: "/shared", modified: "2026-06-05T11:00:00.000Z" },
    ])).toEqual(["/shared", "/older"]);
  });
});
