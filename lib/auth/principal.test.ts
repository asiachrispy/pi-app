import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { livoPrincipalFromSession } from "./principal";

describe("AuthPrincipal", () => {
  beforeEach(() => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", "test-secret-32-byte-minimum-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps livo session to tenant principal", () => {
    const principal = livoPrincipalFromSession({
      livoUserId: "user-1",
      email: "a@b.c",
      storeKey: "k",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(principal).toEqual({
      kind: "livo",
      tenantId: "user-1",
      livoUserId: "user-1",
      email: "a@b.c",
      name: undefined,
    });
  });
});
