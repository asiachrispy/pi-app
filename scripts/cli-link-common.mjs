// Shared helpers for installing/uninstalling the global `pi` command that
// forwards to the pi coding-agent CLI bundled with pi-app.
//
// Design notes:
// - We deliberately do NOT declare `bin.pi` in package.json. npm refuses to
//   overwrite a global bin owned by another package (EEXIST) and would make
//   `npm i -g pi-app` fail outright when the user already has `pi` installed.
// - Instead postinstall conditionally creates the link only when no `pi`
//   exists, and removes it only if we are the ones who made it.
// - The global `pi` is a STANDALONE shim (not a symlink into the package).
//   npm does not run uninstall lifecycle scripts (postuninstall), so after
//   `npm uninstall -g pi-app` the shim would otherwise dangle. A standalone
//   shim degrades gracefully: running `pi` then prints how to reinstall/remove
//   instead of failing with a confusing "no such file" error.

import { execFileSync } from "node:child_process";
import { chmodSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const isWindows = process.platform === "win32";

/** Marker embedded in every shim we generate, used to detect ownership. */
export const SHIM_MARKER = "pi-app-managed-cli";

const here = dirname(fileURLToPath(import.meta.url));

/** pi-app package root (the dir containing package.json). */
export function getPkgRoot() {
  return resolve(here, "..");
}

/** Absolute path to the launcher the shim forwards to. */
export function getLauncherPath() {
  return join(getPkgRoot(), "bin", "pi.js");
}

/** True when npm is running this lifecycle script for a global install. */
export function isGlobalInstall() {
  return process.env.npm_config_global === "true";
}

/**
 * Resolve the directory npm links global bins into.
 * Unix: <prefix>/bin. Windows: <prefix> itself.
 */
export function getGlobalBinDir() {
  const prefix = process.env.npm_config_prefix;
  if (prefix) return isWindows ? prefix : join(prefix, "bin");

  // Fallback: derive from the install location of this package.
  // Unix:    <prefix>/lib/node_modules/pi-app
  // Windows: <prefix>/node_modules/pi-app
  const pkgRoot = getPkgRoot();
  return isWindows
    ? resolve(pkgRoot, "..", "..")
    : resolve(pkgRoot, "..", "..", "..", "bin");
}

/** Path of the global command file we manage. */
export function getLinkPath(binDir) {
  return join(binDir, isWindows ? "pi.cmd" : "pi");
}

/** Whether an existing global `pi` is a shim created by us (safe to manage). */
export function shimIsOurs(linkPath) {
  try {
    return readFileSync(linkPath, "utf8").includes(SHIM_MARKER);
  } catch {
    return false;
  }
}

/** True if some `pi` command is already resolvable on PATH. */
export function piExistsOnPath() {
  const finder = isWindows ? "where" : "which";
  try {
    execFileSync(finder, ["pi"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Best-effort detection of "something already occupies this path". */
export function pathOccupied(linkPath) {
  try {
    lstatSync(linkPath); // lstat so broken symlinks count as occupied too
    return true;
  } catch {
    return false;
  }
}

export function makeExecutable(file) {
  if (isWindows) return;
  try {
    chmodSync(file, 0o755);
  } catch {
    // best effort
  }
}

const TAG = "[pi-app] ";
export function log(msg) {
  process.stdout.write(`${TAG}${msg}\n`);
}
export function warn(msg) {
  process.stderr.write(`${TAG}${msg}\n`);
}
