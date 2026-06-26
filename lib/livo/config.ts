import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { DEFAULT_LIVO_WORKSPACE_ROOT } from "./workspace-root";
import { isLivoIntegrationEnabled, isLivoSsoEnabled } from "./sso-flags";

export { DEFAULT_LIVO_WORKSPACE_ROOT, isLivoIntegrationEnabled, isLivoSsoEnabled };

/** Livo 多租户工作区根目录（绝对路径，仅 Node/server）。 */
export function resolveLivoWorkspaceRoot(): string {
  const configured = process.env.PI_WEB_LIVO_WORKSPACE_ROOT?.trim();
  if (configured) return resolve(configured);
  return resolve(join(homedir(), "livo"));
}
