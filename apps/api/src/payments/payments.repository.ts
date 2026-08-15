import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Deliberately not a dependency on OrdersRepository: this module is
// imported *by* OrdersModule (for OrdersController's new payment route),
// the reverse would be circular. A minimal direct query on `order` here is
// the same boundary SlotsRepository/AddressesRepository already keep
// (orders.module.ts's own comment: they're consumed by orders, never the
// other way around).
export interface OrderForPayment {
  id: string;
  userId: string;
  status: string;
  totalXof: number | null;
}

interface CreatePaymentData {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  amountXof: number;
  idempotencyKey: string;
  providerRef: string | null;
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrderForPayment(orderId: string): Promise<OrderForPayment | null> {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true, totalXof: true },
    });
  }

  findByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({ where: { orderId } });
  }

  findById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  // F-PAY-03. The webhook's entire replay guard: idempotencyKey is unique,
  // so this is a single indexed lookup, never a scan.
  findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.payment.findUnique({ where: { idempotencyKey } });
  }

  create(data: CreatePaymentData) {
    return this.prisma.payment.create({ data: { ...data, status: 'PENDING' } });
  }

  // Single-row update, no transaction needed -- PAID/FAILED never touches
  // anything else (unlike the CASH auto-settle in
  // OrdersRepository.transitionToDelivered, which happens inside the
  // delivery transaction because it's paired with a status change there).
  settleFromWebhook(paymentId: string, status: Extract<PaymentStatus, 'PAID' | 'FAILED'>) {
    return this.prisma.payment.update({ where: { id: paymentId }, data: { status } });
  }
}
