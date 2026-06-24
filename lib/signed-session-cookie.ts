import { createHmac, timingSafeEqual } from "node:crypto";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSessionCookieValue(sessionId: string, expiresAtMs: number, secret: string): string {
  const payload = `${sessionId}.${expiresAtMs}`;
  return `${payload}.${signPayload(payload, secret)}`;
}

export function parseSessionCookieValue(value: string, secret: string): { sessionId: string; expiresAtMs: number } | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, expiresRaw, signature] = parts;
  if (!sessionId || !expiresRaw || !signature) return null;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs)) return null;
  const payload = `${sessionId}.${expiresRaw}`;
  const expected = signPayload(payload, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  if (Date.now() > expiresAtMs) return null;
  return { sessionId, expiresAtMs };
}
