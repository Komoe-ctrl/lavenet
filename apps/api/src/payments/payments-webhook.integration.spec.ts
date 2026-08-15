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
import { SandboxMobileMoneyProvider } from './sandbox-mobile-money.provider';

// Real HTTP + real database. F-PAY-03: signature verified before any DB
// access, replay is a genuine no-op (asserted against the database, not
// the response code), and the demo simulate trigger goes through the exact
// same handler a real signed callback would.
//
// `new SandboxMobileMoneyProvider()` (no DI) signs requests the way an
// external caller would -- this is deliberately independent of the
// simulate endpoint under test #4 below, which exercises the *service's
// own* signing path.
describe('Payment webhook (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const signer = new SandboxMobileMoneyProvider();

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let clientUser: { id: string };
  let tokenClient: string;

  const categoryId = `cat-webhook-test-${runId}`;
  const serviceId = `svc-webhook-test-${runId}`;

  function signToken(userId: string): string {
    return jwt.sign({ sub: userId, role: 'CLIENT' }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  async function createOrderWithMobileMoneyPayment(): Promise<{ orderId: string; paymentId: string }> {
    const order = await prisma.order.create({
      data: {
        userId: clientUser.id,
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
      },
    });
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${order.id}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'MOBILE_MONEY' })
      .expect(201);
    return { orderId: order.id, paymentId: res.body.payment.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // rawBody: true -- main.ts sets this for the real app, but integration
    // tests build the Nest application directly via createNestApplication()
    // and never run main.ts's bootstrap, so it has to be requested here too
    // or req.rawBody is undefined and the webhook signature check compares
    // against an empty string.
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Test',
        email: `webhook-client-${runId}@lavenet.test`,
        phone: `+22539${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenClient = signToken(clientUser.id);

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-webhook-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: { id: serviceId, categoryId, slug: `lavage-kg-webhook-test-${runId}`, name: 'Lavage au kilo (test)', unit: 'KG', processingHours: 24 },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { order: { userId: clientUser.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: clientUser.id } } });
    await prisma.order.deleteMany({ where: { userId: clientUser.id } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: clientUser.id } });
    await app.close();
  });

  it('rejects a webhook with an invalid signature before touching the database', async () => {
    const { paymentId } = await createOrderWithMobileMoneyPayment();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const rawBody = JSON.stringify({ idempotencyKey: payment.idempotencyKey, status: 'PAID' });

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'not-the-real-signature')
      .send(rawBody);
    expect(res.status).toBe(401);

    const untouched = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(untouched.status).toBe('PENDING');
    expect(untouched.updatedAt.getTime()).toBe(payment.updatedAt.getTime());
  });

  it('settles PENDING to PAID via a correctly signed webhook, and replaying it is a no-op verified in the database', async () => {
    const { paymentId } = await createOrderWithMobileMoneyPayment();
    const before = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const rawBody = JSON.stringify({ idempotencyKey: before.idempotencyKey, status: 'PAID' });
    const signature = signer.sign(rawBody);

    const firstCall = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-signature', signature)
      .send(rawBody);
    expect(firstCall.status).toBe(200);

    const afterFirst = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(afterFirst.status).toBe('PAID');

    // Replay: identical body, identical signature. The point of this test
    // is the database, not the HTTP status -- a webhook handler that
    // silently reprocesses on replay would still return 200 here.
    const secondCall = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-signature', signature)
      .send(rawBody);
    expect(secondCall.status).toBe(200);

    const afterReplay = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(afterReplay.status).toBe('PAID');
    // No write happened on replay -- if it had, updatedAt would have moved.
    expect(afterReplay.updatedAt.getTime()).toBe(afterFirst.updatedAt.getTime());
  });

  it('the sandbox simulate trigger settles a payment through the real signed webhook path', async () => {
    const { paymentId } = await createOrderWithMobileMoneyPayment();

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/${paymentId}/sandbox/simulate`)
      .send({ outcome: 'PAID' });
    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('PAID');
  });

  it('the sandbox simulate trigger can also report FAILED', async () => {
    const { paymentId } = await createOrderWithMobileMoneyPayment();

    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/${paymentId}/sandbox/simulate`)
      .send({ outcome: 'FAILED' })
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('FAILED');
  });

  it('a webhook for an unknown idempotencyKey is rejected, not silently accepted', async () => {
    const rawBody = JSON.stringify({ idempotencyKey: 'does-not-exist', status: 'PAID' });
    const signature = signer.sign(rawBody);

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/payments/webhook`)
      .set('Content-Type', 'application/json')
      .set('x-signature', signature)
      .send(rawBody);
    expect(res.status).toBe(404);
  });
});
