import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { OtpPurpose } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { env } from '../config/env';
import { OtpService } from '../otp/otp.service';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

const DELIVERY_OTP_TTL_MS = 24 * 60 * 60 * 1000;

// Real HTTP + real database, own throwaway fixtures (same convention as
// admin-orders.integration.spec.ts). F-LIV-03/04/05: this is the file that
// proves "un livreur ne voit que sa tournée" (CLAUDE.md) with a real IDOR
// case, not just a role check -- courierA and courierB each get their own
// assigned delivery, and every route is exercised across both.
describe('Couriers (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let otpService: OtpService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);

  let courierA: { id: string };
  let courierB: { id: string };
  let clientUser: { id: string; fullName: string | null; phone: string };
  let adminUser: { id: string };
  let tokenCourierA: string;
  let tokenCourierB: string;
  let tokenClient: string;
  let tokenAdmin: string;

  const categoryId = `cat-couriers-test-${runId}`;
  const serviceId = `svc-couriers-test-${runId}`;
  const timeSlotIds: string[] = [];

  function signToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  // dayOffset: pins every slot this run creates to a run-specific future
  // day, so a rerun (or a previous run whose own afterAll cleanup didn't
  // complete) can never collide with this one's rows on TimeSlot's
  // (date, startsAt) unique constraint. minuteOffset separately keeps
  // slots created *within* this same run distinct, since several fixtures
  // below intentionally reuse the same hour (distinct tests, same
  // time-of-day for realism).
  const dayOffset = 1 + (parseInt(runId.slice(0, 4), 16) % 500);
  let minuteOffset = 0;

  function daysFromNowAtUtc(days: number, hour: number): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hour, minuteOffset, 0, 0);
    return d;
  }

  async function createSlot(id: string, hour: number, capacity = 5) {
    timeSlotIds.push(id);
    minuteOffset += 1;
    const startsAt = daysFromNowAtUtc(dayOffset, hour);
    const endsAt = daysFromNowAtUtc(dayOffset, hour + 1);
    return prisma.timeSlot.create({
      data: { id, date: startsAt, startsAt, endsAt, capacity },
    });
  }

  async function createDelivery(opts: {
    reference: string;
    courierId: string | null;
    deliverySlotId: string;
    payment?: { provider: 'CASH' | 'MOBILE_MONEY'; status: 'PENDING' | 'PAID' };
  }) {
    const order = await prisma.order.create({
      data: {
        userId: clientUser.id,
        status: 'OUT_FOR_DELIVERY',
        reference: opts.reference,
        courierId: opts.courierId,
        pickupType: 'HOME',
        deliverySlotId: opts.deliverySlotId,
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
        fromStatus: 'READY',
        toStatus: 'OUT_FOR_DELIVERY',
        actorId: adminUser.id,
      },
    });
    if (opts.payment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: opts.payment.provider,
          status: opts.payment.status,
          amountXof: 3400,
          idempotencyKey: randomUUID(),
        },
      });
    }
    return order.id;
  }

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

    courierA = await prisma.user.create({
      data: {
        fullName: 'Livreur A Test',
        email: `couriers-a-${runId}@lavenet.test`,
        phone: `+22535${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'COURIER',
      },
    });
    courierB = await prisma.user.create({
      data: {
        fullName: 'Livreur B Test',
        email: `couriers-b-${runId}@lavenet.test`,
        phone: `+22536${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'COURIER',
      },
    });
    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Test',
        email: `couriers-client-${runId}@lavenet.test`,
        phone: `+22537${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    adminUser = await prisma.user.create({
      data: {
        fullName: 'Admin Test',
        email: `couriers-admin-${runId}@lavenet.test`,
        phone: `+22538${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'ADMIN',
      },
    });
    tokenCourierA = signToken(courierA.id, 'COURIER');
    tokenCourierB = signToken(courierB.id, 'COURIER');
    tokenClient = signToken(clientUser.id, 'CLIENT');
    tokenAdmin = signToken(adminUser.id, 'ADMIN');

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-couriers-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: {
        id: serviceId,
        categoryId,
        slug: `lavage-kg-couriers-test-${runId}`,
        name: 'Lavage au kilo (test)',
        unit: 'KG',
        processingHours: 24,
      },
    });
  }, 30_000);

  afterAll(async () => {
    const userIds = [courierA.id, courierB.id, clientUser.id, adminUser.id];
    await prisma.invoice.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    // SlotBooking has no `order` relation to filter through (only a scalar
    // orderId) -- slotId is scoped to this run's own timeSlotIds instead.
    await prisma.slotBooking.deleteMany({ where: { slotId: { in: timeSlotIds } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.timeSlot.deleteMany({ where: { id: { in: timeSlotIds } } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('GET /couriers/deliveries', () => {
    it('rejects with no token', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .expect(401);
    });

    it('rejects a CLIENT token with 403', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .set('Authorization', `Bearer ${tokenClient}`)
        .expect(403);
    });

    it('rejects an ADMIN token with 403 -- this surface is COURIER-only', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(403);
    });

    it("returns only the caller's own deliveries, with address/phone/amount due", async () => {
      const slotEarly = await createSlot(`slot-tour-early-${runId}`, 8);
      const slotLate = await createSlot(`slot-tour-late-${runId}`, 14);
      const orderCash = await createDelivery({
        reference: `LN-TEST-${runId}-TOUR-CASH`,
        courierId: courierA.id,
        deliverySlotId: slotLate.id,
        payment: { provider: 'CASH', status: 'PENDING' },
      });
      const orderPaid = await createDelivery({
        reference: `LN-TEST-${runId}-TOUR-PAID`,
        courierId: courierA.id,
        deliverySlotId: slotEarly.id,
        payment: { provider: 'MOBILE_MONEY', status: 'PAID' },
      });
      const orderOther = await createDelivery({
        reference: `LN-TEST-${runId}-TOUR-OTHER`,
        courierId: courierB.id,
        deliverySlotId: slotEarly.id,
      });
      await createDelivery({
        reference: `LN-TEST-${runId}-TOUR-UNASSIGNED`,
        courierId: null,
        deliverySlotId: slotEarly.id,
      });

      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send();
      expect(res.status).toBe(200);

      const ids = res.body.deliveries.map((d: { id: string }) => d.id);
      expect(ids).toEqual([orderPaid, orderCash]); // sorted by slot start time
      expect(ids).not.toContain(orderOther);

      const cashRow = res.body.deliveries.find((d: { id: string }) => d.id === orderCash);
      expect(cashRow).toMatchObject({
        clientName: 'Client Test',
        clientPhone: clientUser.phone,
        deliveryCommune: 'Cocody',
        amountDueXof: 3400,
      });
      const paidRow = res.body.deliveries.find((d: { id: string }) => d.id === orderPaid);
      expect(paidRow.amountDueXof).toBeNull();

      // Symmetric: courierB's own tour shows exactly their delivery, none
      // of courierA's -- "un livreur ne voit que sa tournée" both ways.
      const resB = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .set('Authorization', `Bearer ${tokenCourierB}`)
        .send();
      expect(resB.body.deliveries.map((d: { id: string }) => d.id)).toEqual([orderOther]);
    });
  });

  describe('POST /couriers/deliveries/:id/confirm', () => {
    it("404s on another courier's delivery (IDOR)", async () => {
      const slot = await createSlot(`slot-confirm-idor-${runId}`, 9);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-CONFIRM-IDOR`,
        courierId: courierB.id,
        deliverySlotId: slot.id,
      });
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/confirm`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ otpCode: '123456' });
      expect(res.status).toBe(404);
    });

    it('rejects a wrong OTP, leaving the order untouched', async () => {
      const slot = await createSlot(`slot-confirm-wrong-${runId}`, 9);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-CONFIRM-WRONG`,
        courierId: courierA.id,
        deliverySlotId: slot.id,
        payment: { provider: 'CASH', status: 'PENDING' },
      });
      await issueDeliveryOtp();

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/confirm`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ otpCode: '000000' });
      expect(res.status).toBe(400);

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('OUT_FOR_DELIVERY');
    });

    it('confirms with a valid OTP: DELIVERED, cash settled, invoice minted', async () => {
      const slot = await createSlot(`slot-confirm-ok-${runId}`, 9);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-CONFIRM-OK`,
        courierId: courierA.id,
        deliverySlotId: slot.id,
        payment: { provider: 'CASH', status: 'PENDING' },
      });
      const otpCode = await issueDeliveryOtp();

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/confirm`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ otpCode });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ orderId, status: 'DELIVERED' });

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('DELIVERED');
      const payment = await prisma.payment.findUniqueOrThrow({ where: { orderId } });
      expect(payment.status).toBe('PAID');
      const invoice = await prisma.invoice.findUnique({ where: { orderId } });
      expect(invoice).not.toBeNull();

      // No longer in the tour once delivered.
      const tourRes = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send();
      expect(tourRes.body.deliveries.map((d: { id: string }) => d.id)).not.toContain(orderId);
    });
  });

  describe('POST /couriers/deliveries/:id/absent', () => {
    it("404s on another courier's delivery (IDOR)", async () => {
      const slot = await createSlot(`slot-absent-idor-${runId}`, 10);
      const newSlot = await createSlot(`slot-absent-idor-new-${runId}`, 15);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-ABSENT-IDOR`,
        courierId: courierB.id,
        deliverySlotId: slot.id,
      });
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/absent`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ reason: 'Client absent', newDeliverySlotId: newSlot.id });
      expect(res.status).toBe(404);
    });

    it('rejects a blank reason', async () => {
      const slot = await createSlot(`slot-absent-blank-${runId}`, 10);
      const newSlot = await createSlot(`slot-absent-blank-new-${runId}`, 15);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-ABSENT-BLANK`,
        courierId: courierA.id,
        deliverySlotId: slot.id,
      });
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/absent`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ reason: '   ', newDeliverySlotId: newSlot.id });
      expect(res.status).toBe(400);
    });

    it('rejects a full replacement slot', async () => {
      const slot = await createSlot(`slot-absent-full-${runId}`, 10);
      const fullSlot = await createSlot(`slot-absent-full-target-${runId}`, 15, 0);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-ABSENT-FULL`,
        courierId: courierA.id,
        deliverySlotId: slot.id,
      });
      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/absent`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ reason: 'Client absent', newDeliverySlotId: fullSlot.id });
      expect(res.status).toBe(400);

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('OUT_FOR_DELIVERY');
      expect(order.deliverySlotId).toBe(slot.id);
    });

    it('reschedules in one atomic action, logging both hops', async () => {
      const slot = await createSlot(`slot-absent-ok-${runId}`, 10);
      const newSlot = await createSlot(`slot-absent-ok-new-${runId}`, 15);
      const orderId = await createDelivery({
        reference: `LN-TEST-${runId}-ABSENT-OK`,
        courierId: courierA.id,
        deliverySlotId: slot.id,
      });

      const res = await request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/couriers/deliveries/${orderId}/absent`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send({ reason: 'Client absent, deuxième tentative', newDeliverySlotId: newSlot.id });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ orderId, status: 'OUT_FOR_DELIVERY' });

      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('OUT_FOR_DELIVERY');
      expect(order.deliverySlotId).toBe(newSlot.id);

      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
      const lastTwo = history.slice(-2);
      expect(lastTwo[0]).toMatchObject({
        fromStatus: 'OUT_FOR_DELIVERY',
        toStatus: 'ON_HOLD',
        reason: 'Client absent, deuxième tentative',
      });
      expect(lastTwo[1]).toMatchObject({ fromStatus: 'ON_HOLD', toStatus: 'OUT_FOR_DELIVERY' });

      const newSlotRow = await prisma.timeSlot.findUniqueOrThrow({ where: { id: newSlot.id } });
      expect(newSlotRow.bookedCount).toBe(1);

      // Still visible in the tour, on the new slot.
      const tourRes = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/couriers/deliveries`)
        .set('Authorization', `Bearer ${tokenCourierA}`)
        .send();
      expect(tourRes.body.deliveries.map((d: { id: string }) => d.id)).toContain(orderId);
    });
  });
});
