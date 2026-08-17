-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'DELIVERY_HANDOFF';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courierId" TEXT;

-- CreateIndex
CREATE INDEX "orders_courierId_status_idx" ON "orders"("courierId", "status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
