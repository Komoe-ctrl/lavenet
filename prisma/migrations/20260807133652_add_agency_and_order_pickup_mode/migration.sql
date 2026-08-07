-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('HOME', 'AGENCY');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "agencyDropoffDate" DATE,
ADD COLUMN     "agencyId" TEXT,
ADD COLUMN     "pickupType" "PickupType";

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "openingHours" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE INDEX "orders_agencyId_idx" ON "orders"("agencyId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
