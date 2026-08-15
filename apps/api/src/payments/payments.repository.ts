import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
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

  create(data: CreatePaymentData) {
    return this.prisma.payment.create({ data: { ...data, status: 'PENDING' } });
  }
}
