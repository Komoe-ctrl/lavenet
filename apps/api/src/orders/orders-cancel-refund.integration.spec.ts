import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { env } from '../config/env';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';
import { SandboxMobileMoneyProvider } from '../payments/sandbox-mobile-money.provider';

// Real HTTP + real database. F-PAY-04/06: cancelling an order that already
// has a PAID Mobile Money payment must refund it, in the same transaction
// as the cancellation (OrdersRepository.cancelOrder) -- deliberately its
// own file rather than an addition to orders-cancel.integration.spec.ts,
// which this session did not touch.
describe('Cancellation refunds an already-paid payment (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const signer = new SandboxMobileMoneyProvider();

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let clientUser: { id: string };
  let tokenClient: string;

  const categoryId = `cat-cancel-refund-test-${runId}`;
  const serviceId = `svc-cancel-refund-test-${runId}`;

  function signToken(userId: string): string {
    return jwt.sign({ sub: userId, role: 'CLIENT' }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  async function createCancellableOrderWithPayment(): Promise<{ orderId: string; paymentId: string }> {
    const order = await prisma.order.create({
      data: {
        userId: clientUser.id,
        status: 'PENDING_PICKUP',
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
      },
    });
    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: 'DRAFT', toStatus: 'PENDING_PICKUP', actorId: clientUser.id },
    });
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'MOBILE_MONEY' })
      .expect(201);
    return { orderId: order.id, paymentId: res.body.payment.id };
  }

  async function settleToPaid(paymentId: string): Promise<void> {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const rawBody = JSON.stringify({ idempotencyKey: payment.idempotencyKey, status: 'PAID' });
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-signature', signer.sign(rawBody))
      .send(rawBody)
      .expect(200);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // rawBody: true -- needed for settleToPaid's webhook call; see the same
    // comment in payments-webhook.integration.spec.ts.
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Test',
        email: `cancel-refund-client-${runId}@lavenet.test`,
        phone: `+22540${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenClient = signToken(clientUser.id);

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-cancel-refund-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: { id: serviceId, categoryId, slug: `lavage-kg-cancel-refund-test-${runId}`, name: 'Lavage au kilo (test)', unit: 'KG', processingHours: 24 },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { order: { userId: clientUser.id } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: clientUser.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: clientUser.id } } });
    await prisma.order.deleteMany({ where: { userId: clientUser.id } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: clientUser.id } });
    await app.close();
  });

  it('refunds a PAID payment when the order is cancelled', async () => {
    const { orderId, paymentId } = await createCancellableOrderWithPayment();
    await settleToPaid(paymentId);

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('REFUNDED');
  });

  it('leaves a still-PENDING payment alone -- nothing to refund', async () => {
    const { orderId, paymentId } = await createCancellableOrderWithPayment();

    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send()
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('PENDING');
  });
});
