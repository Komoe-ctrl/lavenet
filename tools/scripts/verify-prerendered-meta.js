// Plain-JS bootstrap, same pattern as warm-up-api.js: sets SWC_NODE_PROJECT
// so @swc-node/register picks up tsconfig.scripts.json (at the workspace
// root, so relative imports into apps/web resolve correctly) before
// requiring the real TS entry point.
const path = require('node:path');

process.env.SWC_NODE_PROJECT = path.resolve(__dirname, '../../tsconfig.scripts.json');
require('@swc-node/register');
const { verifyPrerenderedMeta } = require('./check-prerendered-meta.ts');

const errors = verifyPrerenderedMeta();
if (errors.length > 0) {
  console.error('[verify-prerendered-meta] Balises Open Graph manquantes ou incorrectes :');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  '[verify-prerendered-meta] OK -- title/description/OG/twitter:card présents, URLs absolues, sur / et /tarifs.',
);
