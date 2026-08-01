// Plain-JS bootstrap, same pattern as generate-openapi-spec.js: sets
// SWC_NODE_PROJECT so @swc-node/register picks up tsconfig.scripts.json
// (at the workspace root, so relative imports into apps/api and apps/web
// resolve correctly) before requiring the real TS entry point.
const path = require('node:path');

process.env.SWC_NODE_PROJECT = path.resolve(__dirname, '../../tsconfig.scripts.json');
require('@swc-node/register');
require('./warm-up-api.ts');
