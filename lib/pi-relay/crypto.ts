import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";

const NONCE_BYTES = 12;

export interface PiRelayKeyPair {
  publicKeyB64: string;
  privateKeyB64: string;
}

export function generateRelayKeyPair(): PiRelayKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    publicKeyB64: publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
    privateKeyB64: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64url"),
  };
}

function importPublicKey(publicKeyB64: string) {
  return createPublicKey({
    key: Buffer.from(publicKeyB64, "base64url"),
    format: "der",
    type: "spki",
  });
}

function importPrivateKey(privateKeyB64: string) {
  return createPrivateKey({
    key: Buffer.from(privateKeyB64, "base64url"),
    format: "der",
    type: "pkcs8",
  });
}

export function deriveSharedKey(localPrivateKeyB64: string, remotePublicKeyB64: string): Buffer {
  const localPrivate = importPrivateKey(localPrivateKeyB64);
  const remotePublic = importPublicKey(remotePublicKeyB64);
  return diffieHellman({ privateKey: localPrivate, publicKey: remotePublic });
}

export function encryptPayload(sharedKey: Buffer, plaintext: string): { nonce: string; ciphertext: string } {
  const nonce = randomBytes(NONCE_BYTES);
  const key = sharedKey.subarray(0, 32);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    nonce: nonce.toString("base64url"),
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64url"),
  };
}

export function decryptPayload(sharedKey: Buffer, nonceB64: string, ciphertextB64: string): string {
  const nonce = Buffer.from(nonceB64, "base64url");
  const combined = Buffer.from(ciphertextB64, "base64url");
  const tag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);
  const key = sharedKey.subarray(0, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
