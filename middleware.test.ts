import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";
import { issueSessionCookieValue } from "./lib/signed-session-cookie";

const LIVO_SECRET = "test-secret-32-byte-minimum-value";

function livoCookie(): string {
  return `pi_livo_session=${issueSessionCookieValue("sid", Date.now() + 60_000, LIVO_SECRET)}`;
}

function apiRequest(pathname: string, method = "GET"): NextRequest {
  return new NextRequest(`http://192.168.1.5:30141${pathname}`, {
    method,
    headers: { host: "192.168.1.5:30141" },
  });
}

function pageRequest(pathname: string, cookie?: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://pi.gottao.com${pathname}`, {
    headers: {
      host: "pi.gottao.com",
      ...headers,
      ...(cookie ? { cookie } : {}),
    },
  });
}

describe("middleware public API matrix", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows only public share read methods without auth", async () => {
    vi.stubEnv("PI_WEB_REMOTE", "");

    expect((await middleware(apiRequest("/api/share/token", "GET"))).status).toBe(200);
    expect((await middleware(apiRequest("/api/share/token", "HEAD"))).status).toBe(200);
    expect((await middleware(apiRequest("/api/share/token", "OPTIONS"))).status).toBe(200);
    expect((await middleware(apiRequest("/api/share/token", "POST"))).status).toBe(403);
  });

  it("keeps remote pairing and client status methods explicit", async () => {
    vi.stubEnv("PI_WEB_REMOTE", "");

    expect((await middleware(apiRequest("/api/remote/pair", "POST"))).status).toBe(200);
    expect((await middleware(apiRequest("/api/remote/pair", "GET"))).status).toBe(403);
    expect((await middleware(apiRequest("/api/remote/client", "GET"))).status).toBe(200);
    expect((await middleware(apiRequest("/api/remote/client", "POST"))).status).toBe(403);
  });

  it("lets health reach its loopback-only route guard but blocks private APIs", async () => {
    vi.stubEnv("PI_WEB_REMOTE", "");

    expect((await middleware(apiRequest("/api/health", "GET"))).status).toBe(200);
    expect((await middleware(apiRequest("/api/sessions", "GET"))).status).toBe(403);
  });

  it("does not let an invalid Pi Livo session cookie bypass private API auth", async () => {
    vi.stubEnv("PI_WEB_REMOTE", "");
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", LIVO_SECRET);

    const res = await middleware(new NextRequest("http://192.168.1.5:30141/api/sessions", {
      headers: {
        host: "192.168.1.5:30141",
        cookie: "pi_livo_session=stale",
      },
    }));

    expect(res.status).toBe(403);
  });

  it("allows the product landing page at the site root", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");

    const res = await middleware(pageRequest("/?session=s1"));

    expect(res.status).toBe(200);
  });

  it("redirects the app entry to Livo SSO when no Pi Livo session exists", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");

    const res = await middleware(pageRequest("/app/?session=s1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://pi.gottao.com/api/livo/sso/start?returnTo=%2Fapp%2F%3Fsession%3Ds1");
  });

  it("allows the app entry when a Pi Livo session cookie exists", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", LIVO_SECRET);

    const res = await middleware(pageRequest("/app/", livoCookie()));

    expect(res.status).toBe(200);
  });

  it("redirects the app entry when the Pi Livo session cookie is invalid", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");
    vi.stubEnv("PI_LIVO_SESSION_SECRET", LIVO_SECRET);

    const res = await middleware(pageRequest("/app/", "pi_livo_session=stale"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://pi.gottao.com/api/livo/sso/start?returnTo=%2Fapp%2F");
  });

  it("redirects the rewritten app entry when Nginx strips /app before proxying", async () => {
    vi.stubEnv("PI_LIVO_SSO_ENABLED", "1");

    const res = await middleware(pageRequest("/?session=s1", undefined, { "x-pi-workbench-entry": "/app" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://pi.gottao.com/api/livo/sso/start?returnTo=%2Fapp%2F%3Fsession%3Ds1");
  });
});
