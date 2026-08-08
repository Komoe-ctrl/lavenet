// Demo-accounts-only seed, deliberately separate from prisma/seed.ts: that
// script refuses to run on any non-empty database, which makes it unusable
// for fixing the demo accounts in production after real data already
// exists there.
//
// Idempotent instead of guarded: never touches an existing account's
// password, role or phone -- only backfills fullName when it's null. This
// is what fixes accounts created by an earlier version of the seed, before
// fullName existed on DEMO_USERS (prisma/demo-accounts-data.ts). Missing
// accounts are still created fresh, with the real password.
//
// Run via `pnpm db:seed:demo-accounts` (dev, reads .env) or
// `pnpm db:seed:demo-accounts:prod` (reads .env.production.local). Same
// CLI-argument convention as every other prod seed script (CLAUDE.md §10).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { DEMO_PASSWORD, seedDemoAccounts } from './demo-accounts-data';

const envFile = process.argv[2] ?? '.env';
try {
  process.loadEnvFile(envFile);
} catch {
  if (process.argv[2]) {
    throw new Error(`Fichier d'environnement introuvable : ${envFile}`);
  }
  // no .env file (CI) — env vars are expected to be set already
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is not set — check ${envFile}.`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  const passwordHash = await hash(DEMO_PASSWORD);
  const result = await seedDemoAccounts(prisma, passwordHash);

  console.log(
    `Comptes de démo synchronisés : ${result.created} créé(s), ${result.updated} nom(s) complété(s).`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
