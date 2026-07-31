// Catalog-only seed, deliberately separate from prisma/seed.ts: that script
// refuses to run on any non-empty database (CLAUDE.md's fresh-database-only
// demo seed), which makes it unusable for populating the catalog in
// production after the accounts already exist there.
//
// This one is idempotent instead of guarded: ServiceCategory/Service/
// ArticleType are upserted by slug (safe to rerun, safe to extend
// catalog-data.ts with new items and rerun), and PriceRule rows are only
// ever added, never rewritten -- see seedCatalog() in catalog-data.ts for
// why. Rerunning against an already-seeded database is a safe no-op.
//
// Run via `pnpm db:seed:catalog` (dev, reads .env) or
// `pnpm db:seed:catalog:prod` (reads .env.production.local — see README
// "Déploiement"). Same CLI-argument convention as prisma/seed.ts / §10 of
// CLAUDE.md: never a shell env var.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedCatalog } from './catalog-data';

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
  const result = await seedCatalog(prisma);

  console.log(
    `Catalogue synchronisé : ${result.categories} catégories, ${result.services} services, ` +
      `${result.articleTypes} types d'article — ${result.priceRulesCreated} tarif(s) ajouté(s), ` +
      `${result.priceRulesUnchanged} déjà présent(s) (inchangé).`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
