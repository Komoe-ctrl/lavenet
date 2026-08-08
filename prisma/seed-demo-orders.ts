// Demo-order seed, deliberately separate from prisma/seed.ts: that script
// refuses to run on any non-empty database, which makes it unusable for
// populating orders in production after the accounts already exist there.
//
// Idempotent instead of guarded: each of the ~25 orders in order-data.ts
// carries a fixed reference (LN-DEMO-NNN, never the real
// order_reference_seq) and is upserted by it -- rerunning is a safe
// no-op that just refreshes the same rows in place.
//
// Requires the demo client (client@lavenet.ci, from prisma/seed.ts) and
// the catalog/agency (seed-catalog.ts/seed-agency.ts) to already exist.
//
// Run via `pnpm db:seed:demo-orders` (dev, reads .env) or
// `pnpm db:seed:demo-orders:prod` (reads .env.production.local). Same
// CLI-argument convention as every other prod seed script (CLAUDE.md §10).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedDemoOrders } from './order-data';

const DEMO_CLIENT_EMAIL = 'client@lavenet.ci';

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

  const client = await prisma.user.findUnique({ where: { email: DEMO_CLIENT_EMAIL } });
  if (!client) {
    await prisma.$disconnect();
    throw new Error(
      `Compte de démo introuvable (${DEMO_CLIENT_EMAIL}) — lancez d'abord le seed des comptes ` +
        '(pnpm db:seed / db:seed:prod) et du catalogue (pnpm db:seed:catalog / db:seed:catalog:prod).',
    );
  }

  const result = await seedDemoOrders(prisma, client.id);
  console.log(
    `Commandes de démo synchronisées : ${result.created} créée(s), ${result.updated} mise(s) à jour.`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
