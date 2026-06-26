import { decideMiddlewareAuth, isRemoteAccessEnabledEnv } from "./auth-decision";
import type { MiddlewareAuthContext } from "./middleware-auth-types";
import {
  getBearerToken,
  getNamedCookie,
  getSessionCookie,
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
  timingSafeEqualString,
} from "./request-auth-common";

export type { MiddlewareAuthContext } from "./middleware-auth-types";
export { isRemoteAccessEnabledEnv } from "./auth-decision";
export {
  getNamedCookie,
  getSessionCookie,
  isLoopbackHostname,
  isLoopbackRequest,
  isSameOriginLoopbackRequest,
} from "./request-auth-common";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function verifySessionCookieValue(value: string, secret: string): Promise<boolean> {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [sessionId, expiresRaw, signature] = parts;
  if (!sessionId || !expiresRaw || !signature) return false;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) return false;

  const payload = `${sessionId}.${expiresRaw}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = bytesToBase64Url(new Uint8Array(signed));
  return timingSafeEqualString(expected, signature);
}

export async function hasValidSignedCookie(req: Request, name: string, secret: string | undefined): Promise<boolean> {
  const value = getNamedCookie(req, name);
  if (!value || !secret) return false;
  return verifySessionCookieValue(value, secret);
}

export async function hasValidLivoSessionCookie(req: Request): Promise<boolean> {
  return hasValidSignedCookie(req, "pi_livo_session", process.env.PI_LIVO_SESSION_SECRET);
}

/** Edge-safe env-backed auth for middleware. Route handlers still run full disk auth. */
export async function authorizeMiddlewareRequest(req: Request): Promise<MiddlewareAuthContext> {
  const loopback = isLoopbackRequest(req);
  const remoteEnabled = isRemoteAccessEnabledEnv();
  const readOnly = process.env.PI_WEB_REMOTE_READ_ONLY === "1";
  const envToken = process.env.PI_WEB_REMOTE_TOKEN;
  const bearer = getBearerToken(req);
  const hasValidBearer = Boolean(envToken && bearer && timingSafeEqualString(bearer, envToken));
  const hasValidLivoCookie = process.env.PI_LIVO_SSO_ENABLED === "1" && await hasValidLivoSessionCookie(req);
  const secret = process.env.PI_WEB_REMOTE_SIGNING_SECRET;
  const cookieValue = getSessionCookie(req);
  const hasValidRemoteCookie = Boolean(secret && cookieValue && await verifySessionCookieValue(cookieValue, secret));
  const decision = decideMiddlewareAuth({
    loopback,
    sameOriginLoopback: isSameOriginLoopbackRequest(req),
    remoteEnabled,
    readOnly,
    hasValidBearer,
    hasValidLivoCookie,
    hasValidRemoteCookie,
    allowRemoteMutations: process.env.PI_WEB_ALLOW_REMOTE_MUTATIONS === "1",
  });

  return {
    authorized: decision.authorized,
    loopback,
    remoteEnabled,
    readOnly,
    reason: decision.reason,
  };
}
