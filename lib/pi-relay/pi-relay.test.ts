import { describe, expect, it } from "vitest";
import { decryptPayload, deriveSharedKey, encryptPayload, generateRelayKeyPair } from "./crypto";
import { buildConnectionOffer, encodeOfferFragment, parseOfferFragment } from "./connection-offer";

describe("pi-relay crypto", () => {
  it("derives matching shared keys", () => {
    const host = generateRelayKeyPair();
    const client = generateRelayKeyPair();
    const hostShared = deriveSharedKey(host.privateKeyB64, client.publicKeyB64);
    const clientShared = deriveSharedKey(client.privateKeyB64, host.publicKeyB64);
    expect(hostShared.equals(clientShared)).toBe(true);
  });

  it("encrypts and decrypts payloads", () => {
    const host = generateRelayKeyPair();
    const client = generateRelayKeyPair();
    const shared = deriveSharedKey(host.privateKeyB64, client.publicKeyB64);
    const payload = JSON.stringify({ type: "http_request", id: "1", method: "GET", path: "/" });
    const encrypted = encryptPayload(shared, payload);
    const decrypted = decryptPayload(shared, encrypted.nonce, encrypted.ciphertext);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
  });
});

describe("pi-relay connection offer", () => {
  it("round-trips offer fragments", () => {
    const offer = buildConnectionOffer({
      serverId: "srv_test",
      hostPublicKeyB64: "abc123",
    });
    const fragment = encodeOfferFragment(offer);
    expect(parseOfferFragment(fragment)).toEqual(offer);
  });
});
