import { Injectable } from '@nestjs/common';
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
}
