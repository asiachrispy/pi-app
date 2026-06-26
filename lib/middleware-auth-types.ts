export interface MiddlewareAuthContext {
  authorized: boolean;
  loopback: boolean;
  remoteEnabled: boolean;
  readOnly: boolean;
  reason: string | null;
}
