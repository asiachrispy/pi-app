#!/usr/bin/env node
"use strict";

// Thin launcher that forwards to the pi coding-agent CLI bundled with pi-app.
// Installed (symlinked / shimmed) as the global `pi` command by
// scripts/install-cli.mjs, but ONLY when no `pi` already exists on the system.
//
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

let cliPath;
try {
  cliPath = require.resolve("@earendil-works/pi-coding-agent/dist/cli.js");
} catch {
  // Fallback to the package-local node_modules layout if resolution fails.
  cliPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "@earendil-works",
    "pi-coding-agent",
    "dist",
    "cli.js",
  );
}

// cli.js reads process.argv.slice(2) itself; requiring it runs the CLI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require(cliPath);
