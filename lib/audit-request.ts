import type { AuthPrincipal } from "@/lib/auth/principal";
import { appendRemoteAuditEvent, getClientIp, type RemoteAuditEvent } from "@/lib/remote-audit-log";
import { resolveAuthPrincipal, resolveLivoPrincipal } from "@/lib/remote-auth";

type RequestAuditFields = Pick<RemoteAuditEvent, "ip" | "path" | "method" | "userAgent" | "tenantId" | "principalKind">;

function tenantIdFromPrincipal(principal: AuthPrincipal | null): string | undefined {
  if (!principal) return undefined;
  if (principal.kind === "livo") return principal.tenantId;
  return undefined;
}

function requestAuditFields(req: Request, principal: AuthPrincipal | null): RequestAuditFields {
  const url = new URL(req.url);
  return {
    ip: getClientIp(req),
    path: url.pathname,
    method: req.method,
    userAgent: req.headers.get("user-agent") ?? undefined,
    tenantId: tenantIdFromPrincipal(principal),
    principalKind: principal?.kind,
  };
}

export function appendRequestAuditEvent(
  req: Request,
  event: Omit<RemoteAuditEvent, "ts" | keyof RequestAuditFields> &
    Partial<Pick<RemoteAuditEvent, "tenantId" | "principalKind" | "userAgent">>,
): RemoteAuditEvent {
  const livoPrincipal = resolveLivoPrincipal(req);
  const principal = resolveAuthPrincipal(req);
  const fields = requestAuditFields(req, principal);
  return appendRemoteAuditEvent({
    ...fields,
    tenantId: event.tenantId ?? livoPrincipal?.tenantId ?? fields.tenantId,
    principalKind: event.principalKind ?? (livoPrincipal ? "livo" : fields.principalKind),
    userAgent: event.userAgent ?? fields.userAgent,
    ...event,
  });
}
