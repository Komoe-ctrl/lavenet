import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { OrderStatus, OtpPurpose } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { env } from '../config/env';
import { OtpService } from '../otp/otp.service';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

const DELIVERY_OTP_TTL_MS = 24 * 60 * 60 * 1000;

// Real HTTP + real database, same convention as admin-orders.integration.spec.ts
// (fixture orders inserted directly at the target status, not marched
// through the whole state machine). F-PAY-01/04/05/06: the payment gate on
// DELIVERED, cash settled in the same call as the transition, and the
// invoice minted by it -- the end-to-end slice increment 2 exists to prove.
describe('Delivery payment gate + invoice issuance (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let otpService: OtpService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let adminUser: { id: string };
  let clientUser: { id: string };
  let otherUser: { id: string };
  let tokenAdmin: string;
  let tokenClient: string;
  let tokenOther: string;

  const categoryId = `cat-delivery-pay-test-${runId}`;
  const serviceId = `svc-delivery-pay-test-${runId}`;

  function signToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  async function createOrderAt(status: OrderStatus, reference: string): Promise<string> {
    const order = await prisma.order.create({
      data: {
        userId: clientUser.id,
        status,
        reference,
        pickupType: 'HOME',
        deliverySlotId: null,
        deliveryCommune: 'Cocody',
        deliveryQuartier: 'Angré',
        deliveryDetails: 'Portail bleu (test)',
        subtotalXof: 2400,
        discountXof: 0,
        deliveryFeeXof: 1000,
        vatRateBps: 0,
        vatAmountXof: 0,
        totalXof: 3400,
        items: { create: [{ serviceId, quantity: 2, unitPriceXof: 1200, instructions: null }] },
      },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: 'DRAFT',
        toStatus: 'PENDING_PICKUP',
        actorId: clientUser.id,
      },
    });
    return order.id;
  }

  // F-LIV-04. Fixtures here are inserted directly at OUT_FOR_DELIVERY
  // (createOrderAt above), bypassing the READY -> OUT_FOR_DELIVERY
  // transition that normally generates this code (AdminOrdersService) --
  // so any test that needs a real DELIVERED attempt mints one by hand,
  // through the same OtpService the real transition uses.
  function issueDeliveryOtp(): Promise<string> {
    return otpService.generate(clientUser.id, OtpPurpose.DELIVERY_HANDOFF, DELIVERY_OTP_TTL_MS);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    otpService = app.get(OtpService);
    const passwordHash = await hash(PASSWORD);

    adminUser = await prisma.user.create({
      data: {
        fullName: 'Admin Test',
        email: `delivery-pay-admin-${runId}@lavenet.test`,
        phone: `+22535${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'ADMIN',
      },
    });
    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Test',
        email: `delivery-pay-client-${runId}@lavenet.test`,
        phone: `+22536${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    otherUser = await prisma.user.create({
      data: {
        fullName: 'Other Test',
        email: `delivery-pay-other-${runId}@lavenet.test`,
        phone: `+22537${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenAdmin = signToken(adminUser.id, 'ADMIN');
    tokenClient = signToken(clientUser.id, 'CLIENT');
    tokenOther = signToken(otherUser.id, 'CLIENT');

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-delivery-pay-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: { id: serviceId, categoryId, slug: `lavage-kg-delivery-pay-test-${runId}`, name: 'Lavage au kilo (test)', unit: 'KG', processingHours: 24 },
    });
  }, 30_000);

  afterAll(async () => {
    const userIds = [adminUser.id, clientUser.id, otherUser.id];
    await prisma.invoice.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects DELIVERED with no payment at all', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-NOPAY`);
    const otpCode = await issueDeliveryOtp();
    const res = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ toStatus: 'DELIVERED', otpCode });
    expect(res.status).toBe(400);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('OUT_FOR_DELIVERY');
  });

  it('rejects DELIVERED while a Mobile Money payment is still pending', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-MMPENDING`);
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'MOBILE_MONEY' });
    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('PENDING');

    const otpCode = await issueDeliveryOtp();
    const deliverRes = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ toStatus: 'DELIVERED', otpCode });
    expect(deliverRes.status).toBe(400);
  });

  it('rejects DELIVERED with no otpCode at all, even with a settled payment', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-NOOTP`);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'CASH' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ toStatus: 'DELIVERED' });
    expect(res.status).toBe(400);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('OUT_FOR_DELIVERY');
  });

  it('rejects DELIVERED with a wrong otpCode, even with a settled payment', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-WRONGOTP`);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'CASH' })
      .expect(201);
    await issueDeliveryOtp();

    const res = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ toStatus: 'DELIVERED', otpCode: '000000' });
    expect(res.status).toBe(400);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('OUT_FOR_DELIVERY');
  });

  it('never lets the client set the payment amount -- it is always order.totalXof', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-AMOUNT`);
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      // amountXof isn't even part of the schema -- if a client sent one
      // anyway, the zod DTO strips it, and the service never reads req.body
      // for it in the first place (payments.service.ts).
      .send({ provider: 'CASH', amountXof: 1 });
    expect(res.status).toBe(201);
    expect(res.body.payment.amountXof).toBe(3400);
  });

  it('rejects a second payment on the same order', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-DUPPAY`);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'CASH' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'CASH' });
    expect(res.status).toBe(400);
  });

  it('never lets one account create a payment on another account\'s order (IDOR)', async () => {
    const orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-PAYIDOR`);
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenOther}`)
      .send({ provider: 'CASH' });
    expect(res.status).toBe(404);
  });

  it('mints a usable demoOtpCode on the READY -> OUT_FOR_DELIVERY transition itself (DEMO_MODE)', async () => {
    const orderId = await createOrderAt('READY', `LN-TEST-${runId}-MINTOTP`);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ provider: 'CASH' })
      .expect(201);

    const outRes = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ toStatus: 'OUT_FOR_DELIVERY' });
    expect(outRes.status).toBe(200);
    expect(outRes.body.demoOtpCode).toMatch(/^\d{6}$/);

    const deliverRes = await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ toStatus: 'DELIVERED', otpCode: outRes.body.demoOtpCode });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.order.status).toBe('DELIVERED');
    // Not reusable -- OtpService.verify consumes it on success.
    expect(deliverRes.body.demoOtpCode).toBeUndefined();
  });

  describe('the cash happy path: one call collects and delivers', () => {
    let orderId: string;
    let invoiceId: string;

    it('creates a PENDING cash payment', async () => {
      orderId = await createOrderAt('OUT_FOR_DELIVERY', `LN-TEST-${runId}-CASH`);
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/payment`)
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ provider: 'CASH' });
      expect(res.status).toBe(201);
      expect(res.body.payment).toMatchObject({ provider: 'CASH', status: 'PENDING', amountXof: 3400 });
    });

    it('DELIVERED settles the cash payment and mints an invoice, in one call', async () => {
      const otpCode = await issueDeliveryOtp();
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ toStatus: 'DELIVERED', otpCode });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('DELIVERED');
      expect(res.body.order.payment).toMatchObject({ provider: 'CASH', status: 'PAID' });
      expect(res.body.order.invoice.number).toMatch(/^LN-FAC-\d{4}-\d{6}$/);
      invoiceId = res.body.order.invoice.id;
    });

    it('downloads a real PDF as the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/invoices/${invoiceId}/pdf`)
        .set('Authorization', `Bearer ${tokenClient}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(Buffer.from(res.body).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('never lets another account download it (IDOR)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/invoices/${invoiceId}/pdf`)
        .set('Authorization', `Bearer ${tokenOther}`);
      expect(res.status).toBe(404);
    });

    it('rejects a made-up invoice id the same way -- existence isn\'t distinguishable from ownership', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/invoices/does-not-exist/pdf`)
        .set('Authorization', `Bearer ${tokenClient}`);
      expect(res.status).toBe(404);
    });
  });
});
