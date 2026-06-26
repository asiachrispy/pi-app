import { resolveLivoWorkspaceRoot } from "@/lib/livo/config";

export function formatLivoWorkspacePath(cwd: string, homeDir?: string): string {
  const livoUsersPrefix = `${resolveLivoWorkspaceRoot()}/users/`;
  if (cwd.startsWith(livoUsersPrefix)) return "Livo 会议任务";

  const path = homeDir && cwd.startsWith(homeDir) ? "~" + cwd.slice(homeDir.length) : cwd;
  const sep = path.includes("/") ? "/" : "\\";
  const parts = path.split(sep).filter(Boolean);
  return parts.length <= 2 ? path : "…/" + parts.slice(-2).join(sep);
}
