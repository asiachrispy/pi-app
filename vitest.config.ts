import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", ".next-dev-*", "dist/**", "tmp/**"],
    pool: "forks",
    testTimeout: 8000,
    hookTimeout: 8000,
    // React 19 ships `act` only in development bundles. setupFile documents
    // why the test scripts in package.json must prefix NODE_ENV=development
    // so the forked worker loads react.development.js before its module
    // cache is locked.
    setupFiles: ["scripts/vitest-setup.ts"],
  },
});

