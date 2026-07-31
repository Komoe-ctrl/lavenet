// Minimal demo dataset: one admin, one client. Referenced by the README's
// "demo accounts" section — keep the credentials below in sync with it.
//
// Run via `pnpm db:seed` (dev, reads .env) or `pnpm db:seed:prod` (reads
// .env.production.local — see README "Déploiement"). Never pass production
// credentials through .env: the risk of accidentally leaving them there and
// developing against prod is exactly what the separate file avoids.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';

// `prisma migrate dev` loads .env via prisma.config.ts before spawning this
// script, but running it directly (pnpm db:seed / db:seed:prod) doesn't —
// load the requested env file here so both invocation paths work. Defaults
// to .env; db:seed:prod passes .env.production.local as argv[2].
const envFile = process.argv[2] ?? '.env';
try {
  process.loadEnvFile(envFile);
} catch {
  if (process.argv[2]) {
    // A specific file was requested (e.g. the prod path) and doesn't
    // exist — that's a setup mistake worth failing loudly on, not a
    // silent fallback to whatever's already in process.env.
    throw new Error(`Fichier d'environnement introuvable : ${envFile}`);
  }
  // no .env file (CI) — env vars are expected to be set already
}

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_USERS = [
  { phone: '+2250700000001', email: 'admin@lavenet.ci', role: 'ADMIN' as const },
  { phone: '+2250700000002', email: 'client@lavenet.ci', role: 'CLIENT' as const },
];

const CATEGORIES = [
  { slug: 'lavage', name: 'Lavage', position: 0 },
  { slug: 'repassage', name: 'Repassage', position: 1 },
  { slug: 'pressing', name: 'Pressing', position: 2 },
  { slug: 'linge-de-maison', name: 'Linge de maison', position: 3 },
  { slug: 'chaussures-accessoires', name: 'Chaussures & accessoires', position: 4 },
] as const;

const ARTICLE_TYPES = [
  { key: 'chemise', name: 'Chemise', iconKey: 'shirt' },
  { key: 'pantalon', name: 'Pantalon', iconKey: 'pants' },
  { key: 'robe', name: 'Robe', iconKey: 'dress' },
  { key: 'costume-2p', name: 'Costume 2 pièces', iconKey: 'suit' },
  { key: 'costume-3p', name: 'Costume 3 pièces', iconKey: 'suit' },
  { key: 'veste', name: 'Veste', iconKey: 'jacket' },
  { key: 'manteau', name: 'Manteau', iconKey: 'coat' },
  { key: 'pull', name: 'Pull', iconKey: 'sweater' },
  { key: 'tshirt', name: 'T-shirt', iconKey: 'tshirt' },
  { key: 'jupe', name: 'Jupe', iconKey: 'skirt' },
  { key: 'drap', name: 'Drap', iconKey: 'sheet' },
  { key: 'taie', name: "Taie d'oreiller", iconKey: 'pillow' },
  { key: 'couette', name: 'Couette', iconKey: 'blanket' },
  { key: 'rideau', name: 'Rideau', iconKey: 'curtain' },
  { key: 'basket', name: 'Basket', iconKey: 'shoe' },
] as const;

// Every price starts life on PAST_FROM. Two items (lavage au kilo,
// repassage chemise) get a second, current row starting at HISTORY_SWITCH
// so the seed demonstrates a real price change (F-CAT-05), not just a flat
// history of single rows.
const PAST_FROM = new Date('2025-06-01T00:00:00Z');
const HISTORY_SWITCH = new Date('2026-01-01T00:00:00Z');

interface PriceRuleSeed {
  articleTypeKey?: string; // omitted = base price, no article-type override
  amountXof: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

interface ServiceSeed {
  slug: string;
  name: string;
  categorySlug: (typeof CATEGORIES)[number]['slug'];
  unit: 'PIECE' | 'KG';
  processingHours: number;
  prices: PriceRuleSeed[];
}

const SERVICES: ServiceSeed[] = [
  {
    slug: 'lavage-au-kilo',
    name: 'Lavage au kilo',
    categorySlug: 'lavage',
    unit: 'KG',
    processingHours: 24,
    prices: [
      { amountXof: 1000, effectiveFrom: PAST_FROM, effectiveTo: HISTORY_SWITCH },
      { amountXof: 1200, effectiveFrom: HISTORY_SWITCH },
    ],
  },
  {
    slug: 'lavage-repassage-au-kilo',
    name: 'Lavage + repassage au kilo',
    categorySlug: 'lavage',
    unit: 'KG',
    processingHours: 48,
    prices: [{ amountXof: 1800, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'repassage-a-la-piece',
    name: 'Repassage à la pièce',
    categorySlug: 'repassage',
    unit: 'PIECE',
    processingHours: 24,
    prices: [
      {
        articleTypeKey: 'chemise',
        amountXof: 400,
        effectiveFrom: PAST_FROM,
        effectiveTo: HISTORY_SWITCH,
      },
      { articleTypeKey: 'chemise', amountXof: 500, effectiveFrom: HISTORY_SWITCH },
      { articleTypeKey: 'pantalon', amountXof: 500, effectiveFrom: PAST_FROM },
      { articleTypeKey: 'robe', amountXof: 750, effectiveFrom: PAST_FROM },
      { articleTypeKey: 'veste', amountXof: 700, effectiveFrom: PAST_FROM },
      { articleTypeKey: 'jupe', amountXof: 500, effectiveFrom: PAST_FROM },
      { articleTypeKey: 'tshirt', amountXof: 400, effectiveFrom: PAST_FROM },
    ],
  },
  {
    slug: 'pressing-costume',
    name: 'Pressing costume',
    categorySlug: 'pressing',
    unit: 'PIECE',
    processingHours: 48,
    prices: [
      { articleTypeKey: 'costume-2p', amountXof: 4000, effectiveFrom: PAST_FROM },
      { articleTypeKey: 'costume-3p', amountXof: 5000, effectiveFrom: PAST_FROM },
    ],
  },
  {
    slug: 'pressing-robe-de-soiree',
    name: 'Pressing robe de soirée',
    categorySlug: 'pressing',
    unit: 'PIECE',
    processingHours: 48,
    prices: [{ articleTypeKey: 'robe', amountXof: 4500, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-couette',
    name: 'Nettoyage couette / couverture',
    categorySlug: 'linge-de-maison',
    unit: 'PIECE',
    processingHours: 72,
    prices: [{ articleTypeKey: 'couette', amountXof: 6000, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-rideaux',
    name: 'Nettoyage rideaux',
    categorySlug: 'linge-de-maison',
    unit: 'PIECE',
    processingHours: 72,
    prices: [{ articleTypeKey: 'rideau', amountXof: 3500, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-tapis',
    name: 'Nettoyage tapis',
    categorySlug: 'linge-de-maison',
    unit: 'PIECE',
    processingHours: 96,
    prices: [{ amountXof: 5000, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-chaussures',
    name: 'Nettoyage chaussures',
    categorySlug: 'chaussures-accessoires',
    unit: 'PIECE',
    processingHours: 48,
    prices: [{ articleTypeKey: 'basket', amountXof: 2500, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-sac-a-main',
    name: 'Nettoyage sac à main',
    categorySlug: 'chaussures-accessoires',
    unit: 'PIECE',
    processingHours: 48,
    prices: [{ amountXof: 3000, effectiveFrom: PAST_FROM }],
  },
];

function mustGet<V>(map: Map<string, V>, key: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Seed data inconsistency: no id found for key "${key}".`);
  }
  return value;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is not set — check ${envFile}.`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

  // Refuses to run against a database that already has data: this seed is
  // meant for a fresh database only, never to silently upsert on top of a
  // live one (production, most of all) and risk masking a wrong-target
  // mistake.
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    await prisma.$disconnect();
    throw new Error(
      `Refus de seed : la base cible contient déjà ${existingUserCount} utilisateur(s). ` +
        'Ce script ne s’exécute que sur une base vide.',
    );
  }

  const passwordHash = await hash(DEMO_PASSWORD);

  for (const user of DEMO_USERS) {
    await prisma.user.create({
      data: { ...user, passwordHash, phoneVerifiedAt: new Date() },
    });
  }

  console.log('Seeded demo accounts (password for both: %s):', DEMO_PASSWORD);
  for (const user of DEMO_USERS) {
    console.log(`  ${user.role.padEnd(6)} — ${user.email}`);
  }

  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.serviceCategory.create({ data: category });
    categoryIdBySlug.set(category.slug, created.id);
  }

  const articleTypeIdByKey = new Map<string, string>();
  for (const articleType of ARTICLE_TYPES) {
    const created = await prisma.articleType.create({
      data: { name: articleType.name, iconKey: articleType.iconKey },
    });
    articleTypeIdByKey.set(articleType.key, created.id);
  }

  for (const service of SERVICES) {
    await prisma.service.create({
      data: {
        slug: service.slug,
        name: service.name,
        categoryId: mustGet(categoryIdBySlug, service.categorySlug),
        unit: service.unit,
        processingHours: service.processingHours,
        priceRules: {
          create: service.prices.map((price) => ({
            articleTypeId: price.articleTypeKey
              ? mustGet(articleTypeIdByKey, price.articleTypeKey)
              : null,
            amountXof: price.amountXof,
            effectiveFrom: price.effectiveFrom,
            effectiveTo: price.effectiveTo ?? null,
          })),
        },
      },
    });
  }

  console.log(
    `Seeded catalog: ${CATEGORIES.length} catégories, ${SERVICES.length} services, ${ARTICLE_TYPES.length} types d'article.`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
