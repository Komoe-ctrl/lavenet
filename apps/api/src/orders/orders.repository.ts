import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatOrderReference } from '@lavenet/shared-domain';
import { PrismaService } from '../prisma/prisma.service';

interface AddItemData {
  orderId: string;
  serviceId: string;
  articleTypeId?: string;
  quantity: number;
  instructions?: string;
}

interface UpdateItemData {
  quantity?: number;
  instructions?: string;
}

type PickupModeData =
  | { pickupType: 'HOME'; agencyId: null; agencyDropoffDate: null }
  | { pickupType: 'AGENCY'; agencyId: string; agencyDropoffDate: Date };

interface SlotsData {
  pickupSlotId: string | null;
  deliverySlotId: string;
}

export interface CheckoutTotals {
  subtotalXof: number;
  discountXof: number;
  deliveryFeeXof: number;
  vatRateBps: number;
  vatAmountXof: number;
  totalXof: number;
}

export interface CheckoutAddressSnapshot {
  commune: string;
  quartier: string;
  details: string;
  geoLat: number | null;
  geoLng: number | null;
}

export interface CheckoutInput {
  orderId: string;
  pickupSlotId: string | null;
  deliverySlotId: string;
  itemPrices: { itemId: string; unitPriceXof: number }[];
  totals: CheckoutTotals;
  referenceYear: number;
  address: CheckoutAddressSnapshot;
}

export type CheckoutSlotFullReason = 'PICKUP_SLOT_FULL' | 'DELIVERY_SLOT_FULL';

const checkoutOrderInclude = {
  items: { include: { service: true, articleType: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type CheckoutOrderRecord = Prisma.OrderGetPayload<{ include: typeof checkoutOrderInclude }>;

export type CheckoutResult =
  { ok: true; order: CheckoutOrderRecord } | { ok: false; reason: CheckoutSlotFullReason };

// Thrown only inside commitCheckout's own transaction, to force a rollback
// of a partial booking (e.g. pickup slot seat taken, then delivery slot
// turns out full) -- always caught before leaving this class, never a
// Nest HTTP exception (CLAUDE.md §3: repositories don't carry HTTP
// semantics, CheckoutService translates CheckoutResult into one).
class SlotFullSignal extends Error {
  constructor(readonly reason: CheckoutSlotFullReason) {
    super(reason);
  }
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // priceRules nested under each item's service (not just the service's own
  // fields) because the cart shows a *live* price on every read
  // (resolveActivePriceRule, never OrderItem.unitPriceXof while DRAFT) --
  // same reason CatalogRepository fetches the full rule history rather than
  // filtering in SQL.
  findDraftOrderWithItems(userId: string) {
    return this.prisma.order.findFirst({
      where: { userId, status: 'DRAFT' },
      include: {
        items: {
          include: {
            service: { include: { priceRules: { include: { articleType: true } } } },
            articleType: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // Not airtight under concurrent requests (Postgres READ COMMITTED lets
  // two transactions both pass the findFirst before either commits the
  // create) -- same level of protection as the address book's default-
  // toggle: this is a single user's own two tabs racing each other, not a
  // cross-actor contention (unlike slot booking, CLAUDE.md §4 rule 4),
  // so the worst case is a split cart, not a security or money bug.
  findOrCreateDraftOrder(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({ where: { userId, status: 'DRAFT' } });
      if (existing) {
        return existing;
      }
      return tx.order.create({ data: { userId, status: 'DRAFT' } });
    });
  }

  // Every price rule the service has ever had, same reason as above --
  // used both to validate a (serviceId, articleTypeId) combo has an active
  // price at add-time and, via the same shape, to resolve it again for
  // display.
  findServiceForPricing(serviceId: string) {
    return this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { priceRules: { include: { articleType: true } } },
    });
  }

  addItem(data: AddItemData) {
    return this.prisma.orderItem.create({ data });
  }

  findItemById(id: string) {
    return this.prisma.orderItem.findUnique({
      where: { id },
      include: { order: true },
    });
  }

  updateItem(id: string, data: UpdateItemData) {
    return this.prisma.orderItem.update({ where: { id }, data });
  }

  removeItem(id: string) {
    return this.prisma.orderItem.delete({ where: { id } });
  }

  clearItems(orderId: string) {
    return this.prisma.orderItem.deleteMany({ where: { orderId } });
  }

  setPickupMode(orderId: string, data: PickupModeData) {
    return this.prisma.order.update({ where: { id: orderId }, data });
  }

  setSlots(orderId: string, data: SlotsData) {
    return this.prisma.order.update({ where: { id: orderId }, data });
  }

  setDeliveryAddress(orderId: string, deliveryAddressId: string) {
    return this.prisma.order.update({ where: { id: orderId }, data: { deliveryAddressId } });
  }

  // F-CMD-05/07. Everything checkout needs in one query: item pricing
  // (same shape as findDraftOrderWithItems, for a fresh resolveActivePriceRule
  // pass), plus the pickup/delivery slots, agency and delivery address --
  // none of which the cart's own read needs, since it only ever shows raw
  // ids (the web already has the full lists to resolve display info from).
  findDraftOrderForCheckout(userId: string) {
    return this.prisma.order.findFirst({
      where: { userId, status: 'DRAFT' },
      include: {
        items: {
          include: {
            service: { include: { priceRules: { include: { articleType: true } } } },
            articleType: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        pickupSlot: true,
        deliverySlot: true,
        deliveryAddress: true,
      },
    });
  }

  // F-CMD-05/07/CLAUDE.md §4 rule 4. One atomic transaction: books the
  // delivery seat (and the pickup seat too, for HOME), consumes the next
  // reference number, freezes every item's price and every order total,
  // and flips DRAFT -> PENDING_PICKUP. Every business precondition (prices
  // still available, minimum order, delivery-vs-processing-time) is
  // CheckoutService's job, checked *before* this is called -- this method
  // only handles what can't be checked in advance: slot capacity under
  // concurrent checkouts.
  async commitCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    try {
      const order = await this.prisma.$transaction(async (tx) => {
        if (input.pickupSlotId) {
          const pickupBooked = await this.bookSeat(tx, input.pickupSlotId, input.orderId);
          if (!pickupBooked) {
            throw new SlotFullSignal('PICKUP_SLOT_FULL');
          }
        }
        const deliveryBooked = await this.bookSeat(tx, input.deliverySlotId, input.orderId);
        if (!deliveryBooked) {
          throw new SlotFullSignal('DELIVERY_SLOT_FULL');
        }

        const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>(
          Prisma.sql`SELECT nextval('order_reference_seq') AS nextval`,
        );
        const reference = formatOrderReference(Number(nextval), input.referenceYear);

        await Promise.all(
          input.itemPrices.map((price) =>
            tx.orderItem.update({
              where: { id: price.itemId },
              data: { unitPriceXof: price.unitPriceXof },
            }),
          ),
        );

        return tx.order.update({
          where: { id: input.orderId },
          data: {
            status: 'PENDING_PICKUP',
            reference,
            subtotalXof: input.totals.subtotalXof,
            discountXof: input.totals.discountXof,
            deliveryFeeXof: input.totals.deliveryFeeXof,
            vatRateBps: input.totals.vatRateBps,
            vatAmountXof: input.totals.vatAmountXof,
            totalXof: input.totals.totalXof,
            deliveryCommune: input.address.commune,
            deliveryQuartier: input.address.quartier,
            deliveryDetails: input.address.details,
            deliveryGeoLat: input.address.geoLat,
            deliveryGeoLng: input.address.geoLng,
          },
          include: checkoutOrderInclude,
        });
      });
      return { ok: true, order };
    } catch (err) {
      if (err instanceof SlotFullSignal) {
        return { ok: false, reason: err.reason };
      }
      throw err;
    }
  }

  // Insert-then-verify, not read-then-insert-if-capacity: the unique
  // constraint on (slotId, seatIndex), not this bookedCount precheck, is
  // the actual capacity guarantee under concurrency (CLAUDE.md §4 rule 4)
  // -- two transactions can both pass the precheck and race on the same
  // seatIndex, and exactly one insert then survives. The precheck alone
  // just avoids a doomed insert attempt in the common (already known full)
  // case.
  private async bookSeat(
    tx: Prisma.TransactionClient,
    slotId: string,
    orderId: string,
  ): Promise<boolean> {
    const slot = await tx.timeSlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.bookedCount >= slot.capacity) {
      return false;
    }
    try {
      await tx.slotBooking.create({ data: { slotId, seatIndex: slot.bookedCount, orderId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
    await tx.timeSlot.update({ where: { id: slotId }, data: { bookedCount: { increment: 1 } } });
    return true;
  }
}
