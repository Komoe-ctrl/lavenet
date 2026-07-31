// Plain-JS bootstrap: sets SWC_NODE_PROJECT so @swc-node/register picks up
// tsconfig.scripts.json (decorators enabled, and — critically — at the
// workspace root so @lavenet/* paths resolve correctly; see that file's
// comment) instead of the workspace root tsconfig.base.json, which lacks
// decorator support. Kept separate so the env var is set before the
// register hook reads it — setting it from within the TS entry file itself
// would be too late.
const path = require('node:path');

// `nx serve`/`nx run` load .env automatically; a plain `node` invocation
// doesn't, and apps/api/src/config/env.ts validates process.env as soon as
// it's imported (transitively, via AppModule) — so this has to happen
// before the require() below.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch {
  // no .env file (CI/production inject real env vars directly)
}

process.env.SWC_NODE_PROJECT = path.resolve(__dirname, '../../tsconfig.scripts.json');
require('@swc-node/register');
require('./generate-openapi-spec.ts');
