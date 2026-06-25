export function formatLivoWorkspacePath(cwd: string, homeDir?: string): string {
  const match = cwd.match(/^(.*\/workspaces\/livo\/users\/[^/]+)(?:\/(.*))?$/);
  if (match) return match[2] ? `Livo 工作区 / ${match[2]}` : "Livo 工作区";

  const path = homeDir && cwd.startsWith(homeDir) ? "~" + cwd.slice(homeDir.length) : cwd;
  const sep = path.includes("/") ? "/" : "\\";
  const parts = path.split(sep).filter(Boolean);
  return parts.length <= 2 ? path : "…/" + parts.slice(-2).join(sep);
}
