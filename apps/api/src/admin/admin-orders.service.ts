import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canTransition, requiresReason } from '@lavenet/shared-domain';
import type {
  AdminListOrdersQuery,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderListResponse,
  OrderStatusValue,
} from '@lavenet/shared-schemas';
import {
  type AdminOrderFilters,
  type OrderDetailRecord,
  OrdersRepository,
} from '../orders/orders.repository';
import { toOrderDetail } from '../orders/orders.service';

// F-ADM-02. Staff-facing counterpart to OrdersService (F-CMD-09) -- reads
// every placed order, not just the caller's own, and can move an order
// through the state machine. Reuses OrdersRepository rather than a second
// one for the same table (see orders.module.ts's export comment).
@Injectable()
export class AdminOrdersService {
  constructor(private readonly repo: OrdersRepository) {}

  async list(query: AdminListOrdersQuery): Promise<AdminOrderListResponse> {
    const filters: AdminOrderFilters = {
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      reference: query.reference,
    };
    const skip = (query.page - 1) * query.pageSize;

    const [total, orders] = await Promise.all([
      this.repo.countAdminOrders(filters),
      this.repo.findAdminOrders(filters, skip, query.pageSize),
    ]);

    const items: AdminOrderListItem[] = orders.map((order) => ({
      id: order.id,
      reference: order.reference as string,
      status: order.status as AdminOrderListItem['status'],
      totalXof: order.totalXof as number,
      itemsCount: order._count.items,
      createdAt: order.createdAt.toISOString(),
      clientName: order.user.fullName,
      clientPhone: order.user.phone,
    }));

    return { orders: items, total, page: query.page, pageSize: query.pageSize };
  }

  // No ownership check (unlike OrdersService.detail) -- an admin can read
  // any placed order. DRAFT still excluded: it's a cart, not a real order.
  async detail(orderId: string): Promise<{ order: AdminOrderDetail }> {
    const order = await this.repo.findOrderDetail(orderId);
    if (!order || order.status === 'DRAFT') {
      throw new NotFoundException('Commande introuvable.');
    }
    return { order: toAdminOrderDetail(order) };
  }

  // F-STA-01/02. The state machine (canTransition) is the single source of
  // truth for what's legal -- this never hardcodes which statuses can
  // follow which, exactly like OrdersService.cancel does for CANCELLED.
  async updateStatus(
    orderId: string,
    actorId: string,
    toStatus: OrderStatusValue,
    reason?: string,
  ): Promise<{ order: AdminOrderDetail }> {
    const existing = await this.repo.findOrderDetail(orderId);
    if (!existing || existing.status === 'DRAFT') {
      throw new NotFoundException('Commande introuvable.');
    }
    if (!canTransition(existing.status, toStatus)) {
      throw new BadRequestException('Cette transition de statut n’est pas autorisée.');
    }
    if (requiresReason(toStatus) && !reason) {
      throw new BadRequestException('Un motif est obligatoire pour ce changement de statut.');
    }

    const result = await this.repo.transitionOrder(
      orderId,
      existing.status,
      toStatus,
      actorId,
      reason,
    );
    if (!result.ok) {
      throw new ConflictException('Le statut de la commande a changé entre-temps -- réessayez.');
    }
    return { order: toAdminOrderDetail(result.order) };
  }
}

function toAdminOrderDetail(order: OrderDetailRecord): AdminOrderDetail {
  return {
    ...toOrderDetail(order),
    clientName: order.user.fullName,
    clientPhone: order.user.phone,
    clientEmail: order.user.email,
  };
}
