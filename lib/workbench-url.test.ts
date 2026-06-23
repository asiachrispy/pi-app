import { describe, expect, it } from "vitest";
import { workbenchPath, workbenchSessionPath } from "./workbench-url";

describe("workbench-url", () => {
  it("keeps navigation inside the current workbench pathname", () => {
    expect(workbenchPath("/app/")).toBe("/app/");
    expect(workbenchPath("/app/", "?view=settings")).toBe("/app/?view=settings");
    expect(workbenchSessionPath("/app/", "019ef3f5-0b0c-70ad-aedb-adbc612cd2b0")).toBe(
      "/app/?session=019ef3f5-0b0c-70ad-aedb-adbc612cd2b0",
    );
  });

  it("falls back to the site root when no pathname is known", () => {
    expect(workbenchPath(null)).toBe("/");
    expect(workbenchSessionPath(undefined, "session id")).toBe("/?session=session%20id");
  });
});
