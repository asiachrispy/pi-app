import type { SessionInfo } from "./types";

type SessionProjectInfo = Pick<SessionInfo, "cwd" | "modified">;

/** Return all project cwds sorted by most recently active session. */
export function getProjectCwds(sessions: SessionProjectInfo[]): string[] {
  const latestByCwd = new Map<string, string>();
  for (const session of sessions) {
    if (!session.cwd) continue;
    const prev = latestByCwd.get(session.cwd);
    if (!prev || session.modified > prev) {
      latestByCwd.set(session.cwd, session.modified);
    }
  }
  return [...latestByCwd.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([cwd]) => cwd);
}
