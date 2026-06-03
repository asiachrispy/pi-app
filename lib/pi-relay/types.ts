export interface PiRelayEndpoint {
  endpoint: string;
}

export interface PiConnectionOfferV1 {
  v: 1;
  serverId: string;
  hostPublicKeyB64: string;
  relay: PiRelayEndpoint;
}

export const PI_OFFER_FRAGMENT_PREFIX = "#pi-offer=";
export const DEFAULT_RELAY_ENDPOINT = "http://127.0.0.1:30142";

export interface HttpTunnelRequest {
  type: "http_request";
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string | null;
}

export interface HttpTunnelResponse {
  type: "http_response";
  id: string;
  status: number;
  headers: Record<string, string>;
  body?: string | null;
}

export interface E2EEHelloMessage {
  type: "e2ee_hello";
  key: string;
}

export interface E2EEReadyMessage {
  type: "e2ee_ready";
}

export interface E2EEPayloadMessage {
  type: "e2ee";
  nonce: string;
  ciphertext: string;
}
