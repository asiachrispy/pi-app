import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  GLOBAL_AUTH_ROUTES,
  LIVO_PUBLIC_ROUTES,
  PUBLIC_ROUTES,
  routeFilePath,
  TENANT_MANUAL_ROUTES,
  TENANT_WITH_TENANT_ROUTES,
} from "./route-coverage";

const ROOT = process.cwd();

function readRouteSource(apiPath: string): string {
  const file = resolve(ROOT, routeFilePath(apiPath));
  expect(existsSync(file), `missing route file: ${routeFilePath(apiPath)}`).toBe(true);
  return readFileSync(file, "utf8");
}

describe("route coverage manifest", () => {
  it("covers every on-disk API route", () => {
    const disk = execSync('find app/api -name route.ts | sed "s|app/api/||;s|/route.ts||"', { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
    const listed = [
      ...TENANT_WITH_TENANT_ROUTES,
      ...TENANT_MANUAL_ROUTES,
      ...GLOBAL_AUTH_ROUTES,
      ...LIVO_PUBLIC_ROUTES,
      ...PUBLIC_ROUTES,
    ].slice().sort();
    expect(listed).toEqual(disk);
  });

  it("tenant routes use withTenant wrapper", () => {
    for (const path of TENANT_WITH_TENANT_ROUTES) {
      const source = readRouteSource(path);
      expect(source, path).toMatch(/withTenant/);
    }
  });

  it("agent/new uses manual tenant context for S2S", () => {
    const source = readRouteSource("agent/new");
    expect(source).toMatch(/runWithTenant\(tenantContextForUserId/);
  });
});
