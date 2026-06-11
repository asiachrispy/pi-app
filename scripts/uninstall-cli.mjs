// postuninstall: remove the global `pi` shim ONLY if we created it.
//
// NOTE: npm does NOT run uninstall lifecycle scripts, so this will typically
// NOT execute on `npm uninstall -g pi-app`. It is kept as best-effort for
// package managers that do honor it (and manual invocation). When it doesn't
// run, the standalone shim degrades gracefully instead of dangling. Never
// fails the uninstall.

import { unlinkSync } from "node:fs";
import {
  getGlobalBinDir,
  getLinkPath,
  isGlobalInstall,
  log,
  shimIsOurs,
  warn,
} from "./cli-link-common.mjs";

function main() {
  if (!isGlobalInstall()) return;

  const binDir = getGlobalBinDir();
  const linkPath = getLinkPath(binDir);

  if (!shimIsOurs(linkPath)) return; // not ours — leave it alone

  unlinkSync(linkPath);
  log(`removed pi CLI shim at ${linkPath}`);
}

try {
  main();
} catch (err) {
  warn(`could not clean up the pi CLI shim: ${err?.message ?? err}`);
}
