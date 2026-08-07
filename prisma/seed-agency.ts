// Agency-only seed, same convention as prisma/seed-catalog.ts: idempotent
// (safe to rerun against a populated database, including production),
// deliberately separate from prisma/seed.ts (fresh-database-only demo
// seed, which also calls seedAgency for a one-shot fresh setup).
//
// Run via `pnpm db:seed:agency` (dev, reads .env) or
// `pnpm db:seed:agency:prod` (reads .env.production.local).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedAgency } from './agency-data';

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
  const result = await seedAgency(prisma);

  console.log(result.created ? 'Agence créée.' : 'Agence déjà présente (mise à jour).');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
