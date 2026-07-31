import type { PrismaClient } from '@prisma/client';

// Shared by prisma/seed.ts (fresh-database demo seed) and
// prisma/seed-catalog.ts (idempotent, safe to rerun against production —
// see that file for why). One data source, one seeding function: the two
// scripts must never describe two different catalogs.

export const CATEGORIES = [
  { slug: 'lavage', name: 'Lavage', position: 0 },
  { slug: 'repassage', name: 'Repassage', position: 1 },
  { slug: 'pressing', name: 'Pressing', position: 2 },
  { slug: 'linge-de-maison', name: 'Linge de maison', position: 3 },
  { slug: 'chaussures-accessoires', name: 'Chaussures & accessoires', position: 4 },
] as const;

export const ARTICLE_TYPES = [
  { slug: 'chemise', name: 'Chemise', iconKey: 'shirt' },
  { slug: 'pantalon', name: 'Pantalon', iconKey: 'pants' },
  { slug: 'robe', name: 'Robe', iconKey: 'dress' },
  { slug: 'costume-2p', name: 'Costume 2 pièces', iconKey: 'suit' },
  { slug: 'costume-3p', name: 'Costume 3 pièces', iconKey: 'suit' },
  { slug: 'veste', name: 'Veste', iconKey: 'jacket' },
  { slug: 'manteau', name: 'Manteau', iconKey: 'coat' },
  { slug: 'pull', name: 'Pull', iconKey: 'sweater' },
  { slug: 'tshirt', name: 'T-shirt', iconKey: 'tshirt' },
  { slug: 'jupe', name: 'Jupe', iconKey: 'skirt' },
  { slug: 'drap', name: 'Drap', iconKey: 'sheet' },
  { slug: 'taie', name: "Taie d'oreiller", iconKey: 'pillow' },
  { slug: 'couette', name: 'Couette', iconKey: 'blanket' },
  { slug: 'rideau', name: 'Rideau', iconKey: 'curtain' },
  { slug: 'basket', name: 'Basket', iconKey: 'shoe' },
] as const;

// Every price starts life on PAST_FROM. Two items (lavage au kilo,
// repassage chemise) get a second, current row starting at HISTORY_SWITCH
// so the seed demonstrates a real price change (F-CAT-05), not just a flat
// history of single rows.
const PAST_FROM = new Date('2025-06-01T00:00:00Z');
const HISTORY_SWITCH = new Date('2026-01-01T00:00:00Z');

interface PriceRuleSeed {
  articleTypeSlug?: string; // omitted = base price, no article-type override
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

export const SERVICES: ServiceSeed[] = [
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
        articleTypeSlug: 'chemise',
        amountXof: 400,
        effectiveFrom: PAST_FROM,
        effectiveTo: HISTORY_SWITCH,
      },
      { articleTypeSlug: 'chemise', amountXof: 500, effectiveFrom: HISTORY_SWITCH },
      { articleTypeSlug: 'pantalon', amountXof: 500, effectiveFrom: PAST_FROM },
      { articleTypeSlug: 'robe', amountXof: 750, effectiveFrom: PAST_FROM },
      { articleTypeSlug: 'veste', amountXof: 700, effectiveFrom: PAST_FROM },
      { articleTypeSlug: 'jupe', amountXof: 500, effectiveFrom: PAST_FROM },
      { articleTypeSlug: 'tshirt', amountXof: 400, effectiveFrom: PAST_FROM },
    ],
  },
  {
    slug: 'pressing-costume',
    name: 'Pressing costume',
    categorySlug: 'pressing',
    unit: 'PIECE',
    processingHours: 48,
    prices: [
      { articleTypeSlug: 'costume-2p', amountXof: 4000, effectiveFrom: PAST_FROM },
      { articleTypeSlug: 'costume-3p', amountXof: 5000, effectiveFrom: PAST_FROM },
    ],
  },
  {
    slug: 'pressing-robe-de-soiree',
    name: 'Pressing robe de soirée',
    categorySlug: 'pressing',
    unit: 'PIECE',
    processingHours: 48,
    prices: [{ articleTypeSlug: 'robe', amountXof: 4500, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-couette',
    name: 'Nettoyage couette / couverture',
    categorySlug: 'linge-de-maison',
    unit: 'PIECE',
    processingHours: 72,
    prices: [{ articleTypeSlug: 'couette', amountXof: 6000, effectiveFrom: PAST_FROM }],
  },
  {
    slug: 'nettoyage-rideaux',
    name: 'Nettoyage rideaux',
    categorySlug: 'linge-de-maison',
    unit: 'PIECE',
    processingHours: 72,
    prices: [{ articleTypeSlug: 'rideau', amountXof: 3500, effectiveFrom: PAST_FROM }],
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
    prices: [{ articleTypeSlug: 'basket', amountXof: 2500, effectiveFrom: PAST_FROM }],
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

export interface SeedCatalogResult {
  categories: number;
  services: number;
  articleTypes: number;
  priceRulesCreated: number;
  priceRulesUnchanged: number;
}

// Idempotent: upserts ServiceCategory/Service/ArticleType by slug (safe to
// update their display metadata in place). PriceRule is never upserted --
// CLAUDE.md §4 rule 2 forbids rewriting price history, so an existing row
// matching (serviceId, articleTypeId, effectiveFrom) is left untouched, and
// only genuinely new rows are created. Safe to call on an empty database
// (prisma/seed.ts) or a populated one (prisma/seed-catalog.ts).
export async function seedCatalog(prisma: PrismaClient): Promise<SeedCatalogResult> {
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      create: category,
      update: { name: category.name, position: category.position },
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  const articleTypeIdBySlug = new Map<string, string>();
  for (const articleType of ARTICLE_TYPES) {
    const row = await prisma.articleType.upsert({
      where: { slug: articleType.slug },
      create: articleType,
      update: { name: articleType.name, iconKey: articleType.iconKey },
    });
    articleTypeIdBySlug.set(articleType.slug, row.id);
  }

  let priceRulesCreated = 0;
  let priceRulesUnchanged = 0;

  for (const service of SERVICES) {
    const row = await prisma.service.upsert({
      where: { slug: service.slug },
      create: {
        slug: service.slug,
        name: service.name,
        categoryId: mustGet(categoryIdBySlug, service.categorySlug),
        unit: service.unit,
        processingHours: service.processingHours,
      },
      update: {
        name: service.name,
        categoryId: mustGet(categoryIdBySlug, service.categorySlug),
        unit: service.unit,
        processingHours: service.processingHours,
      },
    });

    for (const price of service.prices) {
      const articleTypeId = price.articleTypeSlug
        ? mustGet(articleTypeIdBySlug, price.articleTypeSlug)
        : null;

      const existing = await prisma.priceRule.findFirst({
        where: { serviceId: row.id, articleTypeId, effectiveFrom: price.effectiveFrom },
      });
      if (existing) {
        priceRulesUnchanged += 1;
        continue;
      }

      await prisma.priceRule.create({
        data: {
          serviceId: row.id,
          articleTypeId,
          amountXof: price.amountXof,
          effectiveFrom: price.effectiveFrom,
          effectiveTo: price.effectiveTo ?? null,
        },
      });
      priceRulesCreated += 1;
    }
  }

  return {
    categories: CATEGORIES.length,
    services: SERVICES.length,
    articleTypes: ARTICLE_TYPES.length,
    priceRulesCreated,
    priceRulesUnchanged,
  };
}
