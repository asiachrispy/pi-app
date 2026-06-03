import type { PiConnectionOfferV1 } from "./types";
import { DEFAULT_RELAY_ENDPOINT, PI_OFFER_FRAGMENT_PREFIX } from "./types";

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64UrlToUtf8(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function buildConnectionOffer(input: {
  serverId: string;
  hostPublicKeyB64: string;
  relayEndpoint?: string;
}): PiConnectionOfferV1 {
  return {
    v: 1,
    serverId: input.serverId,
    hostPublicKeyB64: input.hostPublicKeyB64,
    relay: { endpoint: input.relayEndpoint ?? DEFAULT_RELAY_ENDPOINT },
  };
}

export function encodeOfferFragment(offer: PiConnectionOfferV1): string {
  return `${PI_OFFER_FRAGMENT_PREFIX}${encodeBase64Url(JSON.stringify(offer))}`;
}

export function buildOfferUrl(origin: string, offer: PiConnectionOfferV1): string {
  return `${origin}${encodeOfferFragment(offer)}`;
}

export function parseOfferFragment(input: string): PiConnectionOfferV1 | null {
  const trimmed = input.trim();
  const index = trimmed.indexOf(PI_OFFER_FRAGMENT_PREFIX);
  if (index === -1) return null;
  const encoded = trimmed.slice(index + PI_OFFER_FRAGMENT_PREFIX.length).trim();
  if (!encoded) return null;
  const json = decodeBase64UrlToUtf8(encoded);
  const parsed = JSON.parse(json) as PiConnectionOfferV1;
  if (parsed.v !== 1 || !parsed.serverId || !parsed.hostPublicKeyB64 || !parsed.relay?.endpoint) {
    throw new Error("Invalid pi connection offer");
  }
  return parsed;
}

export function parseOfferUrl(input: string): PiConnectionOfferV1 | null {
  return parseOfferFragment(input);
}
