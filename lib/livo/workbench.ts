/**
 * Pi Web 工作台路径约定（prod 默认 /app/，可由 PI_WORKBENCH_BASE_PATH 覆盖）。
 *
 * 当前 prod 由 Nginx 将 /app/ 反代到 Next 的 / 并设置 X-Pi-Workbench-Entry。
 * 尚未启用 next.config basePath —— 见 wiki/adr/0002-edge-node-auth-layers.md。
 */

export const WORKBENCH_ENTRY_HEADER = "x-pi-workbench-entry";

/** 默认工作台 URL 前缀（带尾部斜杠，如 /app/）。 */
export const DEFAULT_WORKBENCH_BASE_PATH = "/app/";

/** 解析工作台 base path（始终带尾部 /）。 */
export function resolveWorkbenchBasePath(): string {
  const configured = process.env.PI_WORKBENCH_BASE_PATH?.trim();
  if (!configured) return DEFAULT_WORKBENCH_BASE_PATH;
  return configured.endsWith("/") ? configured : `${configured}/`;
}

/** 工作台入口 pathname（无尾部斜杠，用于 header 匹配，如 /app）。 */
export function workbenchEntryPathname(): string {
  const base = resolveWorkbenchBasePath();
  return base.endsWith("/") ? base.slice(0, -1) || "/" : base;
}

/** 构建带 query 的工作台 returnTo（相对路径，如 /app/?session=...）。 */
export function workbenchReturnTo(search = ""): string {
  const base = resolveWorkbenchBasePath();
  if (!search) return base;
  return search.startsWith("?") ? `${base}${search}` : `${base}?${search}`;
}

/** 构建 SSO start URL（相对路径）。 */
export function buildSsoStartUrl(search = ""): string {
  const returnTo = encodeURIComponent(workbenchReturnTo(search));
  return `/api/livo/sso/start?returnTo=${returnTo}`;
}

/** 浏览器可见的工作台 deep link（绝对 URL 需配合 PI_PUBLIC_ORIGIN）。 */
export function workbenchPublicUrl(origin: string, search = ""): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${workbenchReturnTo(search)}`;
}

export function isWorkbenchEntry(pathname: string, headers: Headers): boolean {
  const entry = workbenchEntryPathname();
  return pathname === entry
    || pathname === resolveWorkbenchBasePath()
    || (pathname === "/" && headers.get(WORKBENCH_ENTRY_HEADER) === entry);
}

/** middleware matcher 需覆盖的工作台 pathname 列表。 */
export function workbenchMiddlewareMatchers(): string[] {
  const entry = workbenchEntryPathname();
  const base = resolveWorkbenchBasePath();
  return entry === base.slice(0, -1)
    ? [entry, base]
    : [entry, base];
}
