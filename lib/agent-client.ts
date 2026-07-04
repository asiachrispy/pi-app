// Client-side helper for POST /api/agent/[id].
//
// Every /api/agent/[id] route returns one of:
//   { success: true, data: <result> }
//   { error: string }              (non-2xx)
//
// Call sites previously repeated the same 5-line fetch block 13× in
// hooks/useAgentSession.ts. This helper collapses that down to one line.

export async function sendAgentCommand<T = unknown>(
  sessionId: string,
  command: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`/api/agent/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
  };
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body.data as T;
}

// Client-side helper for POST /api/agent/new.
//
// Same response contract as sendAgentCommand:
//   { success: true, sessionId, data }
//   { error: string }
//
// Returns just { sessionId } so call sites can ignore the fire-and-forget
// `data` field that the route fills in for prompt dispatches.
export async function sendAgentNewCommand(
  command: Record<string, unknown>,
): Promise<{ sessionId: string }> {
  const res = await fetch("/api/agent/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    sessionId?: string;
    error?: string;
  };
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (!body.sessionId) {
    throw new Error("Missing sessionId in /api/agent/new response");
  }
  return { sessionId: body.sessionId };
}
