import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildSsoStartUrl,
  DEFAULT_WORKBENCH_BASE_PATH,
  resolveWorkbenchBasePath,
  workbenchPublicUrl,
  workbenchReturnTo,
} from "./workbench";

describe("workbench paths", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to /app/", () => {
    expect(resolveWorkbenchBasePath()).toBe(DEFAULT_WORKBENCH_BASE_PATH);
    expect(workbenchReturnTo("?session=s1")).toBe("/app/?session=s1");
  });

  it("honors PI_WORKBENCH_BASE_PATH", () => {
    vi.stubEnv("PI_WORKBENCH_BASE_PATH", "/workbench");
    expect(resolveWorkbenchBasePath()).toBe("/workbench/");
    expect(buildSsoStartUrl("?session=s1")).toBe(
      "/api/livo/sso/start?returnTo=%2Fworkbench%2F%3Fsession%3Ds1",
    );
  });

  it("builds public deep links", () => {
    expect(workbenchPublicUrl("https://pi.gottao.com", "?workspace=livo:u1")).toBe(
      "https://pi.gottao.com/app/?workspace=livo:u1",
    );
  });
});
