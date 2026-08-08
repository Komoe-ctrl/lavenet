import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  OrderDetail,
  OrderListItem,
  OrderStatusHistoryEntry,
  PlacedOrderStatus,
} from '@lavenet/shared-schemas';
import { formatIsoDate } from './format-iso-date';
import { type OrderDetailRecord, OrdersRepository } from './orders.repository';
import { toOrderItem } from './to-order-item';

// F-CMD-09. History list + detail for the client's own placed orders --
// separate from CartService/CheckoutService, which own the DRAFT ->
// PENDING_PICKUP boundary, not what happens to an order afterwards.
@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersRepository) {}

  async list(userId: string, status?: PlacedOrderStatus): Promise<{ orders: OrderListItem[] }> {
    const orders = await this.repo.findPlacedOrdersForUser(userId, status);
    return {
      orders: orders.map((order) => ({
        id: order.id,
        reference: order.reference as string,
        status: order.status as PlacedOrderStatus,
        totalXof: order.totalXof as number,
        itemsCount: order._count.items,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  // Same 404-either-way pattern as AddressesService.assertOwnedAddress
  // (CLAUDE.md §5, IDOR): "doesn't exist", "belongs to someone else" and
  // "still a DRAFT" (never a real placed order) all look identical to the
  // caller.
  async detail(userId: string, orderId: string): Promise<{ order: OrderDetail }> {
    const order = await this.repo.findOrderDetail(orderId);
    if (!order || order.userId !== userId || order.status === 'DRAFT') {
      throw new NotFoundException('Commande introuvable.');
    }
    return { order: toOrderDetail(order) };
  }
}

function toOrderDetail(order: OrderDetailRecord): OrderDetail {
  return {
    id: order.id,
    reference: order.reference as string,
    status: order.status as PlacedOrderStatus,
    items: order.items.map(toOrderItem),
    subtotalXof: order.subtotalXof as number,
    discountXof: order.discountXof as number,
    deliveryFeeXof: order.deliveryFeeXof as number,
    vatRateBps: order.vatRateBps as number,
    vatAmountXof: order.vatAmountXof as number,
    totalXof: order.totalXof as number,
    pickupType: order.pickupType as 'HOME' | 'AGENCY',
    agencyId: order.agencyId,
    agencyDropoffDate: order.agencyDropoffDate ? formatIsoDate(order.agencyDropoffDate) : null,
    pickupSlotId: order.pickupSlotId,
    deliverySlotId: order.deliverySlotId as string,
    deliveryCommune: order.deliveryCommune as string,
    deliveryQuartier: order.deliveryQuartier as string,
    deliveryDetails: order.deliveryDetails as string,
    deliveryGeoLat: order.deliveryGeoLat,
    deliveryGeoLng: order.deliveryGeoLng,
    createdAt: order.createdAt.toISOString(),
    statusHistory: order.statusHistory.map((entry): OrderStatusHistoryEntry => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus as PlacedOrderStatus,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}
