import { defineConfig, env } from 'prisma/config';

// The Prisma CLI (migrate, studio, db pull...) doesn't load `.env`
// automatically in Prisma 7 — load it explicitly for local development.
// In CI/production the real env vars are injected directly, so a missing
// `.env` file here is not an error.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file (CI, production) — env vars are expected to be set already
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node -r @swc-node/register prisma/seed.ts',
  },
  // Migrations run against the direct (non-pooled) connection — see
  // CLAUDE.md §4 rule 11 and docs/AUDIT.md's Prisma pooling risk.
  datasource: {
    url: env('DIRECT_URL'),
  },
});
