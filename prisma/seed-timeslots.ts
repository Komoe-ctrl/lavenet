// Rolling time-slot seed, same convention as prisma/seed-catalog.ts and
// prisma/seed-agency.ts: idempotent, safe to rerun against a populated
// database (including production). Unlike those two, this one is meant to
// be rerun periodically (e.g. weekly) to keep the slot window populated --
// see prisma/timeslot-data.ts for why.
//
// Run via `pnpm db:seed:slots` (dev, reads .env) or
// `pnpm db:seed:slots:prod` (reads .env.production.local).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedTimeSlots } from './timeslot-data';

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
  const result = await seedTimeSlots(prisma);

  console.log(
    `Créneaux synchronisés : ${result.created} créé(s), ${result.unchanged} déjà présent(s).`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
