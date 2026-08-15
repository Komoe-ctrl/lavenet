import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { formatInvoiceNumber } from '@lavenet/shared-domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersRepository } from './orders.repository';

// Real database, repository called directly (no HTTP layer) -- this is
// specifically about the transaction OrdersRepository.transitionToDelivered
// runs, not about the admin controller/guards already covered by
// admin-delivery-payment.integration.spec.ts. Anchored on its own client/
// service fixtures so it never shares state with that file.
describe('Invoice numbering: concurrency and rollback (integration)', () => {
  let prisma: PrismaService;
  let repo: OrdersRepository;

  const runId = randomUUID().slice(0, 8);
  const year = new Date().getUTCFullYear();
  let clientUserId: string;
  let categoryId: string;
  let serviceId: string;
  const orderIds: string[] = [];

  async function createDeliverableOrder(): Promise<string> {
    // randomUUID, not orderIds.length -- two calls started concurrently
    // (Promise.all in the test below) would both read length 0 before
    // either push()es, colliding on Order.reference's unique constraint.
    const order = await prisma.order.create({
      data: {
        userId: clientUserId,
        status: 'OUT_FOR_DELIVERY',
        reference: `LN-TEST-${runId}-${randomUUID()}`,
        pickupType: 'HOME',
        deliveryCommune: 'Cocody',
        deliveryQuartier: 'Angré',
        deliveryDetails: 'Portail bleu (test)',
        subtotalXof: 2400,
        discountXof: 0,
        deliveryFeeXof: 1000,
        vatRateBps: 0,
        vatAmountXof: 0,
        totalXof: 3400,
        items: { create: [{ serviceId, quantity: 2, unitPriceXof: 1200 }] },
        payment: { create: { provider: 'CASH', status: 'PENDING', amountXof: 3400, idempotencyKey: randomUUID() } },
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  async function getLastNumber(): Promise<number> {
    const [{ lastNumber }] = await prisma.$queryRaw<{ lastNumber: number }[]>`
      SELECT "lastNumber" FROM "invoice_counters" WHERE id = 1
    `;
    return lastNumber;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersRepository, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    repo = moduleRef.get(OrdersRepository);

    const user = await prisma.user.create({
      data: {
        fullName: 'Invoice Numbering Test',
        email: `invoice-numbering-${runId}@lavenet.test`,
        phone: `+22538${Date.now().toString().slice(-8)}`,
        passwordHash: 'x',
        phoneVerifiedAt: new Date(),
      },
    });
    clientUserId = user.id;

    categoryId = `cat-invoice-numbering-${runId}`;
    serviceId = `svc-invoice-numbering-${runId}`;
    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-invoice-numbering-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: { id: serviceId, categoryId, slug: `lavage-kg-invoice-numbering-${runId}`, name: 'Lavage au kilo (test)', unit: 'KG', processingHours: 24 },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: clientUserId } });
    await prisma.$disconnect();
  });

  it('assigns consecutive numbers to two deliveries settled concurrently', async () => {
    const [orderA, orderB] = await Promise.all([createDeliverableOrder(), createDeliverableOrder()]);

    const [resultA, resultB] = await Promise.all([
      repo.transitionToDelivered(orderA, 'OUT_FOR_DELIVERY', clientUserId, year),
      repo.transitionToDelivered(orderB, 'OUT_FOR_DELIVERY', clientUserId, year),
    ]);

    if (!resultA.ok || !resultB.ok) {
      throw new Error('expected both deliveries to succeed');
    }
    const seqA = Number(resultA.order.invoice?.number.split('-').pop());
    const seqB = Number(resultB.order.invoice?.number.split('-').pop());
    // The row lock (SELECT ... FOR UPDATE on invoice_counters) serializes
    // the two transactions -- this is a deterministic assertion, not a
    // race that happens to usually pass.
    expect(Math.abs(seqA - seqB)).toBe(1);
    expect(resultA.order.invoice?.number).not.toBe(resultB.order.invoice?.number);
  });

  it('a transaction that fails after taking the counter lock consumes no number', async () => {
    const before = await getLastNumber();
    const blockedNumber = formatInvoiceNumber(before + 1, year);

    // Pre-occupy the number the counter is about to hand out, on an
    // unrelated order, so the real attempt's tx.invoice.create collides on
    // the unique `number` constraint *after* it has already locked and
    // incremented the counter -- forcing a real rollback, not a simulated
    // one.
    const blockerOrderId = await createDeliverableOrder();
    await prisma.invoice.create({
      data: {
        orderId: blockerOrderId,
        number: blockedNumber,
        issuerName: 'x',
        issuerAddress: 'x',
        issuerContact: 'x',
        vatRateBps: 0,
      },
    });

    const orderId = await createDeliverableOrder();
    await expect(
      repo.transitionToDelivered(orderId, 'OUT_FOR_DELIVERY', clientUserId, year),
    ).rejects.toThrow();

    const afterFailedAttempt = await getLastNumber();
    expect(afterFailedAttempt).toBe(before);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('OUT_FOR_DELIVERY');
    const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
    expect(payment.status).toBe('PENDING');

    // Free the number back up, then confirm the retry gets exactly the
    // number the failed attempt never actually consumed -- no gap.
    await prisma.invoice.deleteMany({ where: { orderId: blockerOrderId } });
    const retry = await repo.transitionToDelivered(orderId, 'OUT_FOR_DELIVERY', clientUserId, year);
    if (!retry.ok) {
      throw new Error('expected the retry to succeed');
    }
    expect(retry.order.invoice?.number).toBe(blockedNumber);
  });
});
