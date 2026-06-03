import { describe, expect, it } from "vitest";
import { isConnectionError } from "./api-fetch";

describe("api-fetch", () => {
  it("detects network and timeout errors", () => {
    expect(isConnectionError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectionError(new DOMException("Timed out", "TimeoutError"))).toBe(true);
    expect(isConnectionError(new Error("HTTP 401"))).toBe(false);
  });
});
