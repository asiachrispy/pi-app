export function workbenchPath(pathname: string | null | undefined, search = ""): string {
  const base = pathname || "/";
  return `${base}${search}`;
}

export function workbenchSessionPath(pathname: string | null | undefined, sessionId: string): string {
  return workbenchPath(pathname, `?session=${encodeURIComponent(sessionId)}`);
}
