-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "deliverySlotId" TEXT,
ADD COLUMN     "pickupSlotId" TEXT;

-- CreateTable
CREATE TABLE "time_slots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_bookings" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_date_startsAt_key" ON "time_slots"("date", "startsAt");

-- CreateIndex
CREATE INDEX "slot_bookings_orderId_idx" ON "slot_bookings"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "slot_bookings_slotId_seatIndex_key" ON "slot_bookings"("slotId", "seatIndex");

-- CreateIndex
CREATE INDEX "orders_pickupSlotId_idx" ON "orders"("pickupSlotId");

-- CreateIndex
CREATE INDEX "orders_deliverySlotId_idx" ON "orders"("deliverySlotId");

-- AddForeignKey
ALTER TABLE "slot_bookings" ADD CONSTRAINT "slot_bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickupSlotId_fkey" FOREIGN KEY ("pickupSlotId") REFERENCES "time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_deliverySlotId_fkey" FOREIGN KEY ("deliverySlotId") REFERENCES "time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
