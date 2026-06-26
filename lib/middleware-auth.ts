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
import { verifyLivoSessionExistsInternal, verifyRemoteSessionExistsInternal } from "./middleware-internal-verify";

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

export async function parseVerifiedLivoSessionId(req: Request): Promise<string | null> {
  const value = getNamedCookie(req, "pi_livo_session");
  const secret = process.env.PI_LIVO_SESSION_SECRET;
  if (!value || !secret) return null;
  if (!(await verifySessionCookieValue(value, secret))) return null;
  const sessionId = value.split(".")[0];
  return sessionId || null;
}

/** HMAC 有效且 session store 存在记录（#11b；无 PI_INTERNAL_VERIFY_TOKEN 时仅验签名）。 */
export async function hasValidLivoSessionWithStore(req: Request): Promise<boolean> {
  if (process.env.PI_LIVO_SSO_ENABLED !== "1") return false;
  const sessionId = await parseVerifiedLivoSessionId(req);
  if (!sessionId) return false;
  return verifyLivoSessionExistsInternal(sessionId);
}

export async function parseVerifiedRemoteSessionId(req: Request): Promise<string | null> {
  const value = getSessionCookie(req);
  const secret = process.env.PI_WEB_REMOTE_SIGNING_SECRET;
  if (!value || !secret) return null;
  if (!(await verifySessionCookieValue(value, secret))) return null;
  const sessionId = value.split(".")[0];
  return sessionId || null;
}

/** Remote pairing cookie：HMAC + store（#11c；无 PI_INTERNAL_VERIFY_TOKEN 时仅验签名）。 */
export async function hasValidRemoteSessionWithStore(req: Request): Promise<boolean> {
  if (!isRemoteAccessEnabledEnv()) return false;
  const sessionId = await parseVerifiedRemoteSessionId(req);
  if (!sessionId) return false;
  return verifyRemoteSessionExistsInternal(sessionId);
}

/** Edge-safe env-backed auth for middleware. Route handlers still run full disk auth. */
export async function authorizeMiddlewareRequest(req: Request): Promise<MiddlewareAuthContext> {
  const loopback = isLoopbackRequest(req);
  const remoteEnabled = isRemoteAccessEnabledEnv();
  const readOnly = process.env.PI_WEB_REMOTE_READ_ONLY === "1";
  const envToken = process.env.PI_WEB_REMOTE_TOKEN;
  const bearer = getBearerToken(req);
  const hasValidBearer = Boolean(envToken && bearer && timingSafeEqualString(bearer, envToken));
  const hasValidLivoCookie = process.env.PI_LIVO_SSO_ENABLED === "1" && await hasValidLivoSessionWithStore(req);
  const hasValidRemoteCookie = await hasValidRemoteSessionWithStore(req);
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
