/** 纯函数：根据已解析的认证信号决定 middleware 是否放行（Edge/Node 共用决策层）。 */

export interface AuthDecisionInput {
  loopback: boolean;
  sameOriginLoopback: boolean;
  remoteEnabled: boolean;
  readOnly: boolean;
  hasValidBearer: boolean;
  hasValidLivoCookie: boolean;
  hasValidRemoteCookie: boolean;
  allowRemoteMutations: boolean;
}

export interface AuthDecision {
  authorized: boolean;
  reason: string | null;
}

export function decideMiddlewareAuth(input: AuthDecisionInput): AuthDecision {
  const {
    loopback,
    sameOriginLoopback,
    remoteEnabled,
    hasValidBearer,
    hasValidLivoCookie,
    hasValidRemoteCookie,
    allowRemoteMutations,
  } = input;

  if (!remoteEnabled) {
    if (loopback && sameOriginLoopback) {
      return { authorized: true, reason: null };
    }
    return {
      authorized: false,
      reason: loopback ? "Cross-origin request rejected" : "Remote access is disabled",
    };
  }

  if (loopback && sameOriginLoopback) {
    return { authorized: true, reason: null };
  }
  if (hasValidBearer) {
    return { authorized: true, reason: null };
  }
  if (hasValidLivoCookie) {
    return { authorized: true, reason: null };
  }
  if (hasValidRemoteCookie) {
    return { authorized: true, reason: null };
  }
  if (allowRemoteMutations) {
    return { authorized: true, reason: null };
  }

  return { authorized: false, reason: "Authentication required" };
}

export function isRemoteAccessEnabledEnv(): boolean {
  return process.env.PI_WEB_REMOTE === "1";
}
