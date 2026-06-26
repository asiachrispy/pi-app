/** Edge middleware 通过 loopback 校验 session store（轨 B / #11b + #11c）。 */

export type InternalSessionKind = "livo" | "remote";

export function isSessionStoreVerifyEnabled(): boolean {
  return Boolean(process.env.PI_INTERNAL_VERIFY_TOKEN?.trim());
}

/** @deprecated 使用 isSessionStoreVerifyEnabled */
export const isLivoSessionStoreVerifyEnabled = isSessionStoreVerifyEnabled;

export function resolveInternalSessionVerifyOrigin(): string {
  const configured = process.env.PI_WEB_INTERNAL_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const port = process.env.PI_WEB_PORT?.trim() || "30141";
  return `http://127.0.0.1:${port}`;
}

export async function verifySessionExistsInternal(
  sessionId: string,
  kind: InternalSessionKind = "livo",
): Promise<boolean> {
  if (!isSessionStoreVerifyEnabled()) {
    return true;
  }
  const token = process.env.PI_INTERNAL_VERIFY_TOKEN!.trim();
  const url = `${resolveInternalSessionVerifyOrigin()}/api/internal/session/exists?sid=${encodeURIComponent(sessionId)}&kind=${kind}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const body = await response.json() as { exists?: boolean };
    return body.exists === true;
  } catch (error) {
    console.error("[pi-app] internal session verify failed:", error);
    return false;
  }
}

export async function verifyLivoSessionExistsInternal(sessionId: string): Promise<boolean> {
  return verifySessionExistsInternal(sessionId, "livo");
}

export async function verifyRemoteSessionExistsInternal(sessionId: string): Promise<boolean> {
  return verifySessionExistsInternal(sessionId, "remote");
}
