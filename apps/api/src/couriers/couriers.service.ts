import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CourierActionResponse,
  CourierDeliveryItem,
  CourierTourResponse,
  PlacedOrderStatus,
} from '@lavenet/shared-schemas';
import { AdminOrdersService } from '../admin/admin-orders.service';
import { type OrderDetailRecord, OrdersRepository } from '../orders/orders.repository';

// F-LIV-03/04/05. Deliberately thin: the state-machine work (DELIVERED,
// with its OTP check and payment/invoice settlement) is
// AdminOrdersService.updateStatus, reused as-is rather than re-implemented
// -- a courier confirming delivery and a staff member overriding it from
// the back-office must behave identically. Only the reschedule-on-absence
// path is genuinely new (rescheduleAfterAbsence, OrdersRepository).
@Injectable()
export class CouriersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly adminOrders: AdminOrdersService,
  ) {}

  async tour(courierId: string): Promise<CourierTourResponse> {
    const orders = await this.repo.findTourForCourier(courierId);
    return { deliveries: orders.map(toCourierDeliveryItem) };
  }

  async confirm(orderId: string, courierId: string, otpCode: string): Promise<CourierActionResponse> {
    await this.findOwnDelivery(orderId, courierId);
    const result = await this.adminOrders.updateStatus(
      orderId,
      courierId,
      'DELIVERED',
      undefined,
      otpCode,
    );
    return { orderId, status: result.order.status };
  }

  async markAbsent(
    orderId: string,
    courierId: string,
    reason: string,
    newDeliverySlotId: string,
  ): Promise<CourierActionResponse> {
    const order = await this.findOwnDelivery(orderId, courierId);
    const result = await this.repo.rescheduleAfterAbsence(
      orderId,
      order.status,
      newDeliverySlotId,
      courierId,
      reason,
    );
    if (!result.ok) {
      if (result.reason === 'SLOT_FULL') {
        throw new BadRequestException('Ce créneau est complet, choisissez-en un autre.');
      }
      throw new ConflictException('Le statut de la commande a changé entre-temps -- réessayez.');
    }
    // Never DRAFT: rescheduleAfterAbsence only ever lands on ON_HOLD or
    // OUT_FOR_DELIVERY, unlike the raw Prisma OrderStatus type it returns.
    return { orderId, status: result.order.status as PlacedOrderStatus };
  }

  // IDOR: 404, not 403 -- same "jamais lire une commande d'autrui" 404-
  // either-way convention as OrdersController (client ownership) and
  // AddressesService.assertOwnedAddress. DRAFT excluded for the same
  // reason it always is: a cart isn't a delivery.
  private async findOwnDelivery(orderId: string, courierId: string): Promise<OrderDetailRecord> {
    const order = await this.repo.findOrderDetail(orderId);
    if (!order || order.status === 'DRAFT' || order.courierId !== courierId) {
      throw new NotFoundException('Livraison introuvable.');
    }
    return order;
  }
}

function toCourierDeliveryItem(
  order: Awaited<ReturnType<OrdersRepository['findTourForCourier']>>[number],
): CourierDeliveryItem {
  const payment = order.payment;
  // Nothing to collect if paid in advance (MOBILE_MONEY, already PAID) or
  // somehow already settled -- CASH pending is the only case a courier
  // actually needs to ask for money.
  const amountDueXof =
    payment && payment.provider === 'CASH' && payment.status === 'PENDING' ? payment.amountXof : null;

  return {
    id: order.id,
    reference: order.reference as string,
    clientName: order.user.fullName,
    clientPhone: order.user.phone,
    deliveryCommune: order.deliveryCommune as string,
    deliveryQuartier: order.deliveryQuartier as string,
    deliveryDetails: order.deliveryDetails as string,
    deliverySlotStartsAt: order.deliverySlot?.startsAt.toISOString() ?? null,
    deliverySlotEndsAt: order.deliverySlot?.endsAt.toISOString() ?? null,
    amountDueXof,
  };
}
