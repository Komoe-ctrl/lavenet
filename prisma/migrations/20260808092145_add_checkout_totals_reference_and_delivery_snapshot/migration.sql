-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliveryAddressId" TEXT,
ADD COLUMN     "deliveryCommune" TEXT,
ADD COLUMN     "deliveryDetails" TEXT,
ADD COLUMN     "deliveryFeeXof" INTEGER,
ADD COLUMN     "deliveryGeoLat" DOUBLE PRECISION,
ADD COLUMN     "deliveryGeoLng" DOUBLE PRECISION,
ADD COLUMN     "deliveryQuartier" TEXT,
ADD COLUMN     "discountXof" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "subtotalXof" INTEGER,
ADD COLUMN     "totalXof" INTEGER,
ADD COLUMN     "vatAmountXof" INTEGER,
ADD COLUMN     "vatRateBps" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE INDEX "orders_deliveryAddressId_idx" ON "orders"("deliveryAddressId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- F-CMD-07: dedicated Postgres sequence for Order.reference, consumed inside
-- the checkout transaction (CLAUDE.md §4 rule 5's "same transaction as the
-- row it numbers" pattern, applied here to Order.reference rather than
-- Invoice). Not reset per year -- the reference format embeds the current
-- year for readability, but the counter itself never rolls back to 1,
-- avoiding any year-boundary collision/reset logic for a detail the
-- cahier's example format doesn't actually require.
CREATE SEQUENCE "order_reference_seq" START WITH 1 INCREMENT BY 1;
