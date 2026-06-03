export interface RemoteSessionRecord {
  id: string;
  createdAt: string;
  userAgent: string;
  lastSeenAt: string;
  /** Host-assigned display label */
  label?: string;
}

export interface RemoteRelayConfig {
  serverId: string;
  hostPublicKeyB64: string;
  hostPrivateKeyB64: string;
  defaultEndpoint: string;
}

export interface RemotePairingCode {
  code: string;
  expiresAt: string;
}

export interface RemoteAuthConfig {
  enabled: boolean;
  /** scrypt hash of the master access token (optional when only pairing is used) */
  tokenHash?: string;
  /** HMAC signing secret for session cookies */
  signingSecret: string;
  allowedHostnames: string[];
  sessions: RemoteSessionRecord[];
  pairingCodes: RemotePairingCode[];
  readOnly?: boolean;
  relay?: RemoteRelayConfig;
}

export interface RemoteAuthPublicStatus {
  enabled: boolean;
  readOnly: boolean;
  allowedHostnames: string[];
  sessionCount: number;
  hasMasterToken: boolean;
}

export interface RemotePairingOffer {
  code: string;
  expiresAt: string;
  pairingUrl: string;
}

export const REMOTE_CONFIG_FILENAME = "pi-web-remote.json";
export const SESSION_COOKIE_NAME = "pi_web_session";
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
