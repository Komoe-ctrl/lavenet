-- Add a stable slug identity to article_types so prisma/seed-catalog.ts can
-- upsert idempotently, without relying on the free-text `name` column.
-- Hand-written (not `prisma migrate dev`, which refuses to add a required
-- column to a non-empty table non-interactively): backfills slugs for the
-- 15 rows the demo seed already created, from their current `name`.
ALTER TABLE "article_types" ADD COLUMN "slug" TEXT;

UPDATE "article_types" SET "slug" = CASE "name"
  WHEN 'Chemise' THEN 'chemise'
  WHEN 'Pantalon' THEN 'pantalon'
  WHEN 'Robe' THEN 'robe'
  WHEN 'Costume 2 pièces' THEN 'costume-2p'
  WHEN 'Costume 3 pièces' THEN 'costume-3p'
  WHEN 'Veste' THEN 'veste'
  WHEN 'Manteau' THEN 'manteau'
  WHEN 'Pull' THEN 'pull'
  WHEN 'T-shirt' THEN 'tshirt'
  WHEN 'Jupe' THEN 'jupe'
  WHEN 'Drap' THEN 'drap'
  WHEN 'Taie d''oreiller' THEN 'taie'
  WHEN 'Couette' THEN 'couette'
  WHEN 'Rideau' THEN 'rideau'
  WHEN 'Basket' THEN 'basket'
END;

ALTER TABLE "article_types" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "article_types_slug_key" ON "article_types"("slug");

-- Replace the plain index with a unique constraint (best-effort duplicate
-- protection for re-seeding -- see the comment on PriceRule in schema.prisma
-- for why this doesn't cover the null-articleTypeId case).
DROP INDEX "price_rules_serviceId_articleTypeId_effectiveFrom_idx";

CREATE UNIQUE INDEX "price_rules_serviceId_articleTypeId_effectiveFrom_key" ON "price_rules"("serviceId", "articleTypeId", "effectiveFrom");
