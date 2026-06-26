import type { StoredLivoSession } from "@/lib/livo-sso";

/** 已认证请求的身份主体（路线 3 预留 tenantId 维度）。 */
export type AuthPrincipal =
  | { kind: "loopback" }
  | { kind: "open"; reason: "allow_remote_mutations" }
  | { kind: "bearer"; scope: "env" | "config" }
  | { kind: "remote"; sessionId: string; readOnly: boolean }
  | { kind: "livo"; tenantId: string; livoUserId: string; email?: string; name?: string };

export function livoPrincipalFromSession(session: StoredLivoSession): AuthPrincipal {
  return {
    kind: "livo",
    tenantId: session.livoUserId,
    livoUserId: session.livoUserId,
    email: session.email,
    name: session.name,
  };
}

export function principalReadOnly(principal: AuthPrincipal): boolean {
  return principal.kind === "remote" && principal.readOnly;
}

export function isLivoPrincipal(
  principal: AuthPrincipal,
): principal is Extract<AuthPrincipal, { kind: "livo" }> {
  return principal.kind === "livo";
}
