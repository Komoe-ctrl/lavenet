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

// Real HTTP + real database, own throwaway fixtures (unique per run, same
// convention as cart.integration.spec.ts). F-CMD-08: client cancellation,
// only from DRAFT/PENDING_PICKUP (ADR 0008), releasing any booked slot
// seats -- the point this file exists to prove.
describe('Order cancellation (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let userA: { id: string };
  let userB: { id: string };
  let tokenA: string;
  let tokenB: string;

  const categoryId = `cat-orders-cancel-test-${runId}`;
  const serviceId = `svc-orders-cancel-test-${runId}`;
  const addressAId = `addr-a-orders-cancel-test-${runId}`;
  const addressBId = `addr-b-orders-cancel-test-${runId}`;
  // Slot ids created across the individual tests -- tracked explicitly
  // (not resolved via each order's pickup/delivery relation in afterAll)
  // because Orders are deleted before TimeSlots there, so a relation
  // lookup at that point would find nothing.
  const timeSlotIds: string[] = [];

  async function createSlot(id: string, date: Date, startsAt: Date, endsAt: Date, capacity = 5) {
    timeSlotIds.push(id);
    return prisma.timeSlot.create({ data: { id, date, startsAt, endsAt, capacity } });
  }

  function signToken(userId: string): string {
    return jwt.sign(
      { sub: userId, role: 'CLIENT' },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }

  function daysFromNowAtUtc(days: number, hour: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour));
  }

  function dateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  // Places a HOME order for `token`, using `pickupSlotId`/`deliverySlotId`,
  // and returns the checkout response body. processingHours is 1h on the
  // fixture service, so pickup+2h/delivery+1h (well below any real grid
  // collision, see beforeAll) always satisfies the minimum-delay rule.
  async function checkout(
    token: string,
    addressId: string,
    pickupSlotId: string,
    deliverySlotId: string,
  ) {
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId, quantity: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pickupType: 'HOME' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pickupSlotId, deliverySlotId })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId })
      .expect(200);
    return request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send();
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    userA = await prisma.user.create({
      data: {
        fullName: 'Aya Coulibaly',
        email: `orders-cancel-a-${runId}@lavenet.test`,
        phone: `+22535${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    userB = await prisma.user.create({
      data: {
        fullName: 'Boubacar Traoré',
        email: `orders-cancel-b-${runId}@lavenet.test`,
        phone: `+22536${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenA = signToken(userA.id);
    tokenB = signToken(userB.id);

    await prisma.address.create({
      data: {
        id: addressAId,
        userId: userA.id,
        label: 'Domicile',
        commune: 'Cocody',
        quartier: 'Angré',
        details: 'Portail bleu (test)',
      },
    });
    await prisma.address.create({
      data: {
        id: addressBId,
        userId: userB.id,
        label: 'Domicile',
        commune: 'Cocody',
        quartier: 'Angré',
        details: 'Portail vert (test)',
      },
    });

    await prisma.serviceCategory.create({
      data: {
        id: categoryId,
        slug: `lavage-orders-cancel-test-${runId}`,
        name: 'Lavage (test)',
        position: 999,
      },
    });
    await prisma.service.create({
      data: {
        id: serviceId,
        categoryId,
        slug: `lavage-au-kilo-orders-cancel-test-${runId}`,
        name: 'Lavage au kilo (test)',
        unit: 'KG',
        processingHours: 1,
        priceRules: {
          create: [{ amountXof: 1200, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });
  }, 45_000);

  afterAll(async () => {
    const userIds = [userA.id, userB.id];
    await prisma.slotBooking.deleteMany({ where: { slotId: { in: timeSlotIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.address.deleteMany({ where: { id: { in: [addressAId, addressBId] } } });
    await prisma.timeSlot.deleteMany({ where: { id: { in: timeSlotIds } } });
    await prisma.priceRule.deleteMany({ where: { serviceId } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects with no token', async () => {
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/does-not-exist/cancel`)
      .expect(401);
  });

  it('cancels a PENDING_PICKUP order and releases its booked slots', async () => {
    const pickupSlotId = `slot-cancel-pickup-${runId}-1`;
    const deliverySlotId = `slot-cancel-delivery-${runId}-1`;
    await createSlot(
      pickupSlotId,
      dateOnly(daysFromNowAtUtc(5, 0)),
      daysFromNowAtUtc(5, 6),
      daysFromNowAtUtc(5, 7),
    );
    await createSlot(
      deliverySlotId,
      dateOnly(daysFromNowAtUtc(5, 0)),
      daysFromNowAtUtc(5, 9),
      daysFromNowAtUtc(5, 10),
    );

    const checkoutRes = await checkout(tokenA, addressAId, pickupSlotId, deliverySlotId);
    expect(checkoutRes.status).toBe(200);
    const orderId = checkoutRes.body.order.id;

    const pickupBefore = await prisma.timeSlot.findUniqueOrThrow({ where: { id: pickupSlotId } });
    expect(pickupBefore.bookedCount).toBe(1);
    const deliveryBefore = await prisma.timeSlot.findUniqueOrThrow({
      where: { id: deliverySlotId },
    });
    expect(deliveryBefore.bookedCount).toBe(1);

    const cancelRes = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe('CANCELLED');
    expect(cancelRes.body.order.statusHistory).toHaveLength(2);
    expect(cancelRes.body.order.statusHistory[1].toStatus).toBe('CANCELLED');

    const pickupAfter = await prisma.timeSlot.findUniqueOrThrow({ where: { id: pickupSlotId } });
    expect(pickupAfter.bookedCount).toBe(0);
    const deliveryAfter = await prisma.timeSlot.findUniqueOrThrow({
      where: { id: deliverySlotId },
    });
    expect(deliveryAfter.bookedCount).toBe(0);
    const bookings = await prisma.slotBooking.findMany({ where: { orderId } });
    expect(bookings).toHaveLength(0);
  }, 45_000);

  it('rejects cancelling an order that is not DRAFT/PENDING_PICKUP', async () => {
    const pickupSlotId = `slot-cancel-pickup-${runId}-2`;
    const deliverySlotId = `slot-cancel-delivery-${runId}-2`;
    await createSlot(
      pickupSlotId,
      dateOnly(daysFromNowAtUtc(6, 0)),
      daysFromNowAtUtc(6, 6),
      daysFromNowAtUtc(6, 7),
    );
    await createSlot(
      deliverySlotId,
      dateOnly(daysFromNowAtUtc(6, 0)),
      daysFromNowAtUtc(6, 9),
      daysFromNowAtUtc(6, 10),
    );
    const checkoutRes = await checkout(tokenA, addressAId, pickupSlotId, deliverySlotId);
    const orderId = checkoutRes.body.order.id;
    // No HTTP path drives PICKED_UP yet (F-ADM is a later lot) -- advance
    // it directly, same convention as orders-history.integration.spec.ts.
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PICKED_UP' } });

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cette commande ne peut plus être annulée.');
  }, 45_000);

  it("never lets one account cancel another account's order (IDOR)", async () => {
    const pickupSlotId = `slot-cancel-pickup-${runId}-3`;
    const deliverySlotId = `slot-cancel-delivery-${runId}-3`;
    await createSlot(
      pickupSlotId,
      dateOnly(daysFromNowAtUtc(7, 0)),
      daysFromNowAtUtc(7, 6),
      daysFromNowAtUtc(7, 7),
    );
    await createSlot(
      deliverySlotId,
      dateOnly(daysFromNowAtUtc(7, 0)),
      daysFromNowAtUtc(7, 9),
      daysFromNowAtUtc(7, 10),
    );
    const checkoutRes = await checkout(tokenB, addressBId, pickupSlotId, deliverySlotId);
    const orderId = checkoutRes.body.order.id;

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();
    expect(res.status).toBe(404);
  }, 45_000);

  it('rejects cancelling an id that does not exist at all', async () => {
    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/does-not-exist/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();
    expect(res.status).toBe(404);
  });

  it('rejects a second cancellation of an already-cancelled order', async () => {
    const pickupSlotId = `slot-cancel-pickup-${runId}-4`;
    const deliverySlotId = `slot-cancel-delivery-${runId}-4`;
    await createSlot(
      pickupSlotId,
      dateOnly(daysFromNowAtUtc(8, 0)),
      daysFromNowAtUtc(8, 6),
      daysFromNowAtUtc(8, 7),
    );
    await createSlot(
      deliverySlotId,
      dateOnly(daysFromNowAtUtc(8, 0)),
      daysFromNowAtUtc(8, 9),
      daysFromNowAtUtc(8, 10),
    );
    const checkoutRes = await checkout(tokenA, addressAId, pickupSlotId, deliverySlotId);
    const orderId = checkoutRes.body.order.id;

    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send()
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send();
    expect(res.status).toBe(400);
  }, 45_000);

  // CLAUDE.md §4 rule 4 / the user's explicit ask this session: a cancel
  // that frees a seat must stay consistent under a concurrent checkout
  // racing for that exact seat. Both outcomes are valid (B books the
  // freed seat, or B sees the slot as still full and is rejected) -- what
  // must never happen is bookedCount drifting from the real booking count.
  it('stays consistent when a cancellation races a checkout for the same delivery slot', async () => {
    const pickupSlotAId = `slot-race-pickup-a-${runId}`;
    const pickupSlotBId = `slot-race-pickup-b-${runId}`;
    const sharedDeliverySlotId = `slot-race-delivery-${runId}`;
    await createSlot(
      pickupSlotAId,
      dateOnly(daysFromNowAtUtc(9, 0)),
      daysFromNowAtUtc(9, 6),
      daysFromNowAtUtc(9, 7),
    );
    await createSlot(
      pickupSlotBId,
      dateOnly(daysFromNowAtUtc(9, 0)),
      daysFromNowAtUtc(9, 7),
      daysFromNowAtUtc(9, 8),
    );
    await createSlot(
      sharedDeliverySlotId,
      dateOnly(daysFromNowAtUtc(9, 0)),
      daysFromNowAtUtc(9, 9),
      daysFromNowAtUtc(9, 10),
      1,
    );

    // A takes the delivery slot's only seat first.
    const checkoutA = await checkout(tokenA, addressAId, pickupSlotAId, sharedDeliverySlotId);
    expect(checkoutA.status).toBe(200);
    const orderAId = checkoutA.body.order.id;

    // B prepares a cart wanting the same (now full) delivery slot, without
    // checking out yet.
    await request(app.getHttpServer())
      .delete(`/${API_GLOBAL_PREFIX}/cart`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/${API_GLOBAL_PREFIX}/cart/items`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ serviceId, quantity: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/pickup`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ pickupType: 'HOME' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/slots`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ pickupSlotId: pickupSlotBId, deliverySlotId: sharedDeliverySlotId })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/${API_GLOBAL_PREFIX}/cart/address`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ addressId: addressBId })
      .expect(200);

    // A cancels (freeing the seat) at the same time B tries to book it.
    const [cancelRes, checkoutBRes] = await Promise.all([
      request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/orders/${orderAId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(),
      request(app.getHttpServer())
        .post(`/${API_GLOBAL_PREFIX}/cart/checkout`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send(),
    ]);

    expect(cancelRes.status).toBe(200);
    expect([200, 409]).toContain(checkoutBRes.status);

    const slot = await prisma.timeSlot.findUniqueOrThrow({
      where: { id: sharedDeliverySlotId },
    });
    const bookings = await prisma.slotBooking.findMany({
      where: { slotId: sharedDeliverySlotId },
    });
    // The invariant that must never break: bookedCount always matches the
    // real number of booking rows, regardless of which request won the race.
    expect(slot.bookedCount).toBe(bookings.length);
    expect(bookings.length).toBeLessThanOrEqual(1);

    if (checkoutBRes.status === 200) {
      expect(bookings[0].orderId).toBe(checkoutBRes.body.order.id);
    } else {
      expect(bookings).toHaveLength(0);
    }
  }, 60_000);
});
