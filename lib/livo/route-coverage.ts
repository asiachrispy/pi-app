/**
 * Pi Web API route 租户/鉴权覆盖清单。
 *
 * 用于审计 withTenant 覆盖面；测试见 route-coverage.test.ts。
 * 更新 route 时必须同步维护本文件。
 */

export type RouteCoverageKind =
  | "tenant-withTenant"
  | "tenant-manual"
  | "global-auth"
  | "livo-public"
  | "public"
  | "health";

export interface RouteCoverageEntry {
  path: string;
  kind: RouteCoverageKind;
  note?: string;
}

/** 应套 withTenant 的 Livo 可达数据 route（方案二 Step 4）。 */
export const TENANT_WITH_TENANT_ROUTES: readonly string[] = [
  "agent/[id]",
  "agent/[id]/events",
  "agent/[id]/export.html",
  "files/[...path]",
  "history",
  "history/[id]",
  "preferences",
  "preferences/excluded",
  "product-sessions/[id]",
  "scene-overrides",
  "scene-overrides/[sceneId]",
  "scene-overrides/export",
  "scene-overrides/import",
  "sessions",
  "sessions/[id]",
  "sessions/[id]/context",
  "sessions/[id]/export",
  "slash-commands",
  "skills",
  "skills/install",
  "terminal/run/[...cwd]",
  "terminal/state/[...cwd]",
  "terminal/stop/[...cwd]",
  "terminal/stream/[...cwd]",
  "usage",
] as const;

/** 手动建立租户上下文（S2S body.livoUserId）。 */
export const TENANT_MANUAL_ROUTES: readonly string[] = [
  "agent/new",
] as const;

/** 全局鉴权、不租户化（模型/凭证/remote 等）。 */
export const GLOBAL_AUTH_ROUTES: readonly string[] = [
  "auth/all-providers",
  "auth/api-key/[provider]",
  "auth/login/[provider]",
  "auth/logout/[provider]",
  "auth/providers",
  "agent/running/events",
  "cwd/validate",
  "default-cwd",
  "extensions",
  "files/stage",
  "git-branch",
  "home",
  "internal/session/exists",
  "livo/logout",
  "livo/me",
  "livo/summary",
  "livo/workspace",
  "livo/workspace/resolve",
  "models",
  "models-config",
  "models-config/test",
  "notifications/agent-end",
  "plugins",
  "push",
  "remote",
  "remote/audit",
  "remote/client",
  "remote/pair",
  "settings/default-model",
  "skills/search",
] as const;

export const LIVO_PUBLIC_ROUTES: readonly string[] = [
  "livo/sso/callback",
  "livo/sso/start",
] as const;

export const PUBLIC_ROUTES: readonly string[] = [
  "health",
  "share/[token]",
  "sessions/new",
  "sessions/[id]/share",
] as const;

export const ROUTE_COVERAGE: RouteCoverageEntry[] = [
  ...TENANT_WITH_TENANT_ROUTES.map((path) => ({ path, kind: "tenant-withTenant" as const })),
  ...TENANT_MANUAL_ROUTES.map((path) => ({ path, kind: "tenant-manual" as const, note: "runWithTenant(tenantContextForUserId)" })),
  ...GLOBAL_AUTH_ROUTES.map((path) => ({ path, kind: "global-auth" as const })),
  ...LIVO_PUBLIC_ROUTES.map((path) => ({ path, kind: "livo-public" as const })),
  ...PUBLIC_ROUTES.map((path) => ({ path, kind: "public" as const })),
];

export function routeFilePath(apiPath: string): string {
  return `app/api/${apiPath}/route.ts`;
}
