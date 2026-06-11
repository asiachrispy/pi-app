// postinstall: make `pi` available globally when (and only when) the user
// doesn't already have a `pi` command. Never fails the install.

import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  getGlobalBinDir,
  getLauncherPath,
  getLinkPath,
  isGlobalInstall,
  isWindows,
  log,
  makeExecutable,
  pathOccupied,
  piExistsOnPath,
  SHIM_MARKER,
  shimIsOurs,
  warn,
} from "./cli-link-common.mjs";

// A standalone shim (not a symlink into the package). It forwards to the
// bundled launcher, and—because npm doesn't run postuninstall—degrades
// gracefully if pi-app is later removed.
function shimContents(launcher) {
  if (isWindows) {
    const q = `"${launcher}"`;
    return [
      "@ECHO off",
      `REM ${SHIM_MARKER} (do not edit) - forwards to the pi CLI bundled with pi-app`,
      `IF EXIST ${q} (`,
      `  node ${q} %*`,
      ") ELSE (",
      "  echo pi: this command is provided by pi-app, which is no longer installed. Reinstall: npm i -g pi-app 1>&2",
      "  EXIT /B 127",
      ")",
      "",
    ].join("\r\n");
  }
  return [
    "#!/usr/bin/env node",
    `// ${SHIM_MARKER} (do not edit) - forwards to the pi CLI bundled with pi-app`,
    '"use strict";',
    'const fs = require("fs");',
    `const launcher = ${JSON.stringify(launcher)};`,
    "if (!fs.existsSync(launcher)) {",
    '  process.stderr.write("pi: this command is provided by pi-app, which is no longer installed.\\n");',
    '  process.stderr.write("Reinstall with: npm i -g pi-app  (or delete this file: " + process.argv[1] + ")\\n");',
    "  process.exit(127);",
    "}",
    "require(launcher);",
    "",
  ].join("\n");
}

function createShim(linkPath, launcher) {
  // npm runs postinstall BEFORE it creates the global bin dir and links bins,
  // so on a fresh prefix this dir may not exist yet.
  mkdirSync(dirname(linkPath), { recursive: true });
  writeFileSync(linkPath, shimContents(launcher), "utf8");
  makeExecutable(linkPath);
}

function main() {
  if (!isGlobalInstall()) return; // only relevant for `npm i -g pi-app`

  const launcher = getLauncherPath();
  if (!pathOccupied(launcher)) {
    warn(`launcher not found at ${launcher}; skipping pi CLI setup.`);
    return;
  }

  const binDir = getGlobalBinDir();
  const linkPath = getLinkPath(binDir);

  // Already our shim from a previous install — refresh it (e.g. path changes).
  if (shimIsOurs(linkPath)) {
    try {
      unlinkSync(linkPath);
    } catch {
      // ignore; createShim overwrites anyway
    }
    createShim(linkPath, launcher);
    log(`pi CLI refreshed -> ${linkPath}`);
    return;
  }

  // Something else owns this path — keep it, don't clobber.
  if (pathOccupied(linkPath)) {
    log(`existing pi found at ${linkPath}; keeping it (not overwriting).`);
    return;
  }

  // A pi exists elsewhere on PATH (e.g. Homebrew, a separate global install).
  if (piExistsOnPath()) {
    log("an existing pi command was found on PATH; keeping it.");
    return;
  }

  createShim(linkPath, launcher);
  log(`pi CLI installed -> ${linkPath}`);
}

try {
  main();
} catch (err) {
  // postinstall must never break `npm i -g pi-app`.
  warn(`could not set up the pi CLI automatically: ${err?.message ?? err}`);
}
