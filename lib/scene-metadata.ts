import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ProductSessionMetadata, ProductSessionMetadataMap } from "./scenes";

function metadataPath(): string {
  return join(getAgentDir(), "product-sessions.json");
}

export function readProductSessionMetadata(): ProductSessionMetadataMap {
  try {
    return JSON.parse(readFileSync(metadataPath(), "utf8")) as ProductSessionMetadataMap;
  } catch {
    return {};
  }
}

export function writeProductSessionMetadata(metadata: ProductSessionMetadataMap): void {
  const filePath = metadataPath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(metadata, null, 2)}\n`);
}

export function upsertProductSessionMetadata(sessionId: string, metadata: ProductSessionMetadata): void {
  const all = readProductSessionMetadata();
  all[sessionId] = metadata;
  writeProductSessionMetadata(all);
}
