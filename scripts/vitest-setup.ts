// Vitest setupFile placeholder.
//
// React 19 only exposes `act` in its development bundle. To make
// `@testing-library/react` work, the test entry points must run with
// `NODE_ENV=development` already set in the parent shell — React picks
// its bundle on first import based on `process.env.NODE_ENV`, and this
// setupFile runs *after* imports have been resolved.
//
// Both `test` and `test:run` scripts in package.json prefix
// `NODE_ENV=development vitest` for this reason. See vitest.config.ts.
export {};
