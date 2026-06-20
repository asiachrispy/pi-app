#!/usr/bin/env node
/**
 * Patch Next.js 16 generate-build-id.js to fall back to `fallback()`
 * when `generate` is not a function.
 *
 * Next.js 16's default config includes `generateBuildId: () => null`, but
 * the config is JSON-serialized for workers / static export, stripping the
 * function. The build then calls the (undefined) `generate` and crashes with
 * "TypeError: generate is not a function".
 *
 * This patch makes the call safe: `typeof generate === "function"
 *   ? generate()
 *   : fallback()`
 * so the build always completes, whether or not the config default survived
 * serialization.
 *
 * Run automatically via the `postinstall` npm script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "..", "node_modules", "next", "dist", "build", "generate-build-id.js");

const ORIGINAL = "let buildId = await generate();";
const PATCHED = "let buildId = await (typeof generate === \"function\" ? generate() : fallback());";

try {
  const content = readFileSync(target, "utf8");
  if (content.includes(PATCHED)) {
    // Already patched
    process.exit(0);
  }
  if (!content.includes(ORIGINAL)) {
    console.error("[patch-next-generate-build-id] Source pattern not found; Next.js may have been updated. Skipping.");
    process.exit(0);
  }
  const patched = content.replace(ORIGINAL, PATCHED);
  writeFileSync(target, patched, "utf8");
  console.log("[patch-next-generate-build-id] Patched generate-build-id.js (fallback-safe)");
} catch (err) {
  // next may not be installed yet during initial npm install
  if (err.code !== "ENOENT") {
    console.error("[patch-next-generate-build-id] Error:", err.message);
  }
  process.exit(0);
}
