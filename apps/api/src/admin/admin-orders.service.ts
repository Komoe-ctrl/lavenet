import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { canTransition, requiresReason } from '@lavenet/shared-domain';
import type {
  AdminCourierListResponse,
  AdminListOrdersQuery,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderListResponse,
  OrderStatusValue,
} from '@lavenet/shared-schemas';
import { env } from '../config/env';
import { SMS_PROVIDER, SmsProvider } from '../notifications/sms/sms-provider.interface';
import { OtpService } from '../otp/otp.service';
import {
  type AdminOrderFilters,
  type OrderDetailRecord,
  OrdersRepository,
} from '../orders/orders.repository';
import { toOrderDetail } from '../orders/orders.service';

// F-LIV-04. 24h, per the cahier (§5.6) -- distinct from OtpService's other
// caller (AuthService, 10 min): the OTP is handed to a courier standing at
// the client's door, potentially the next day, not typed in immediately.
const DELIVERY_OTP_TTL_MS = 24 * 60 * 60 * 1000;

// F-ADM-02. Staff-facing counterpart to OrdersService (F-CMD-09) -- reads
// every placed order, not just the caller's own, and can move an order
// through the state machine. Reuses OrdersRepository rather than a second
// one for the same table (see orders.module.ts's export comment).
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly otp: OtpService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

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
  //
  // otpCode: F-LIV-04. Only ever consulted for toStatus=DELIVERED -- and
  // canTransition already guarantees that target is reachable only from
  // OUT_FOR_DELIVERY (order-state-machine.ts's TRANSITIONS has no other
  // entry pointing at it), so there's no need to separately check
  // existing.status here.
  async updateStatus(
    orderId: string,
    actorId: string,
    toStatus: OrderStatusValue,
    reason?: string,
    otpCode?: string,
  ): Promise<{ order: AdminOrderDetail; demoOtpCode?: string }> {
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

    // F-PAY-01/04/06. DELIVERED is the one target that also touches
    // Payment/Invoice, inside its own transaction (transitionToDelivered) --
    // everything else keeps using the general-purpose transitionOrder.
    if (toStatus === 'DELIVERED') {
      if (!otpCode) {
        throw new BadRequestException('Un code de confirmation est requis pour livrer.');
      }
      const verification = await this.otp.verify(
        existing.userId,
        OtpPurpose.DELIVERY_HANDOFF,
        otpCode,
      );
      if (!verification.ok) {
        throw new BadRequestException('Code de confirmation invalide ou expiré.');
      }

      const result = await this.repo.transitionToDelivered(
        orderId,
        existing.status,
        actorId,
        new Date().getFullYear(),
      );
      if (!result.ok) {
        if (result.reason === 'NO_PAYMENT' || result.reason === 'PAYMENT_NOT_SETTLED') {
          throw new BadRequestException(
            'Cette commande ne peut pas être livrée sans paiement encaissé.',
          );
        }
        throw new ConflictException('Le statut de la commande a changé entre-temps -- réessayez.');
      }
      return { order: toAdminOrderDetail(result.order) };
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

    // F-LIV-04. "généré à la sortie du colis" -- the moment a courier is
    // about to actually go out, not any earlier. Sent to the client's own
    // phone, never the courier's: they're the one who has to read it back.
    if (toStatus === 'OUT_FOR_DELIVERY') {
      const demoOtpCode = await this.issueDeliveryOtp(existing.userId, result.order.user.phone);
      return { order: toAdminOrderDetail(result.order), demoOtpCode };
    }

    return { order: toAdminOrderDetail(result.order) };
  }

  async listCouriers(): Promise<AdminCourierListResponse> {
    const couriers = await this.repo.listCouriers();
    return { couriers };
  }

  // F-LIV-02. courierId is intentionally unconstrained by order status at
  // this layer (a courier can be assigned as soon as READY, reassigned
  // later) -- the state machine already governs when OUT_FOR_DELIVERY/
  // DELIVERED are reachable, this is an orthogonal piece of data, not a
  // transition.
  async assignCourier(orderId: string, courierId: string): Promise<{ order: AdminOrderDetail }> {
    const existing = await this.repo.findOrderDetail(orderId);
    if (!existing || existing.status === 'DRAFT') {
      throw new NotFoundException('Commande introuvable.');
    }
    const courier = await this.repo.findCourierById(courierId);
    if (!courier) {
      throw new BadRequestException('Ce livreur est introuvable.');
    }

    const order = await this.repo.assignCourier(orderId, courierId);
    return { order: toAdminOrderDetail(order) };
  }

  // Returns the raw code only in DEMO_MODE, same convention as
  // AuthService.issuePhoneOtp -- never present otherwise, so it can't leak
  // into a response or a log outside the explicitly-opted-into demo
  // deployment (CLAUDE.md §11).
  private async issueDeliveryOtp(userId: string, phone: string): Promise<string | undefined> {
    const code = await this.otp.generate(userId, OtpPurpose.DELIVERY_HANDOFF, DELIVERY_OTP_TTL_MS);
    await this.smsProvider.send(
      phone,
      `Votre colis LaveNet arrive. Code de remise à donner au livreur : ${code} (valable 24h).`,
    );
    return env.DEMO_MODE ? code : undefined;
  }
}

function toAdminOrderDetail(order: OrderDetailRecord): AdminOrderDetail {
  return {
    ...toOrderDetail(order),
    clientName: order.user.fullName,
    clientPhone: order.user.phone,
    clientEmail: order.user.email,
    courierId: order.courierId,
    courierName: order.courier?.fullName ?? null,
  };
}
