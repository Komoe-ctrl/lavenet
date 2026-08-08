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
// convention as cart.integration.spec.ts). Orders here are inserted
// directly via Prisma rather than driven through checkout: this suite
// tests the *read* side (F-CMD-09) across every placed status, and no
// HTTP endpoint can drive an order past PENDING_PICKUP yet (F-ADM,
// staff-driven transitions, is a later lot) -- so PICKED_UP/DELIVERED/
// CANCELLED fixtures are seeded straight into the DB, same as this repo's
// other suites seed catalog/agency fixtures directly.
describe('Order history (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let userA: { id: string };
  let userB: { id: string };
  let tokenA: string;

  const categoryId = `cat-orders-history-test-${runId}`;
  const serviceId = `svc-orders-history-test-${runId}`;
  const slotId = `slot-history-${runId}`;

  let draftOrderId: string;
  let pendingOrderId: string;
  let deliveredOrderId: string;
  let cancelledOrderId: string;
  let userBOrderId: string;

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
        fullName: 'Adjoua Brou',
        email: `orders-history-a-${runId}@lavenet.test`,
        phone: `+22533${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    userB = await prisma.user.create({
      data: {
        fullName: 'Bilé Konan',
        email: `orders-history-b-${runId}@lavenet.test`,
        phone: `+22534${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenA = signToken(userA.id);

    await prisma.serviceCategory.create({
      data: {
        id: categoryId,
        slug: `lavage-orders-history-test-${runId}`,
        name: 'Lavage (test)',
        position: 999,
      },
    });
    await prisma.service.create({
      data: {
        id: serviceId,
        categoryId,
        slug: `lavage-au-kilo-orders-history-test-${runId}`,
        name: 'Lavage au kilo (test)',
        unit: 'KG',
        processingHours: 24,
      },
    });
    // Hour 6 deliberately off the demo seed's grid (prisma/timeslot-data.ts
    // uses 8/10/14/16) so this throwaway fixture never collides with the
    // rolling window's own (date, startsAt) unique constraint -- same
    // precedent as cart.integration.spec.ts.
    await prisma.timeSlot.create({
      data: {
        id: slotId,
        date: daysFromNowAtUtc(10, 0),
        startsAt: daysFromNowAtUtc(10, 6),
        endsAt: daysFromNowAtUtc(10, 7),
        capacity: 5,
      },
    });

    async function createPlacedOrder(opts: {
      userId: string;
      reference: string;
      status: 'PENDING_PICKUP' | 'DELIVERED' | 'CANCELLED';
      createdAt: Date;
    }) {
      const order = await prisma.order.create({
        data: {
          userId: opts.userId,
          status: opts.status,
          reference: opts.reference,
          createdAt: opts.createdAt,
          pickupType: 'HOME',
          pickupSlotId: slotId,
          deliverySlotId: slotId,
          deliveryCommune: 'Cocody',
          deliveryQuartier: 'Angré',
          deliveryDetails: 'Portail bleu (test)',
          subtotalXof: 2400,
          discountXof: 0,
          deliveryFeeXof: 1000,
          vatRateBps: 0,
          vatAmountXof: 0,
          totalXof: 3400,
          items: {
            create: [
              { serviceId, quantity: 2, unitPriceXof: 1200, instructions: null },
              { serviceId, quantity: 1, unitPriceXof: 1200, instructions: null },
            ],
          },
        },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: 'DRAFT',
          toStatus: 'PENDING_PICKUP',
          actorId: opts.userId,
        },
      });
      if (opts.status !== 'PENDING_PICKUP') {
        // Synthetic "fast-forward" row, not a real transition-by-transition
        // history -- there's no HTTP path to drive intermediate statuses
        // yet (see the describe block's top comment). Enough to prove the
        // list/detail endpoints surface whatever history rows exist.
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'PENDING_PICKUP',
            toStatus: opts.status,
            actorId: opts.userId,
            reason: null,
          },
        });
      }
      return order.id;
    }

    const draftOrder = await prisma.order.create({
      data: { userId: userA.id, status: 'DRAFT' },
    });
    draftOrderId = draftOrder.id;

    pendingOrderId = await createPlacedOrder({
      userId: userA.id,
      reference: `LN-TEST-${runId}-1`,
      status: 'PENDING_PICKUP',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    });
    deliveredOrderId = await createPlacedOrder({
      userId: userA.id,
      reference: `LN-TEST-${runId}-2`,
      status: 'DELIVERED',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    });
    cancelledOrderId = await createPlacedOrder({
      userId: userA.id,
      reference: `LN-TEST-${runId}-3`,
      status: 'CANCELLED',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    });
    userBOrderId = await createPlacedOrder({
      userId: userB.id,
      reference: `LN-TEST-${runId}-4`,
      status: 'PENDING_PICKUP',
      createdAt: new Date(),
    });
  }, 30_000);

  afterAll(async () => {
    const userIds = [userA.id, userB.id];
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.timeSlot.delete({ where: { id: slotId } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('GET /orders', () => {
    it('rejects with no token', async () => {
      await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/orders`).expect(401);
    });

    it("lists only the caller's own placed orders, newest first, DRAFT excluded", async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(200);
      const ids = res.body.orders.map((o: { id: string }) => o.id);
      expect(ids).toEqual([pendingOrderId, cancelledOrderId, deliveredOrderId]);
      expect(ids).not.toContain(draftOrderId);
      expect(ids).not.toContain(userBOrderId);
      const first = res.body.orders[0];
      expect(first.itemsCount).toBe(2);
      expect(first.totalXof).toBe(3400);
    });

    it('filters by status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders?status=DELIVERED`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.orders).toHaveLength(1);
      expect(res.body.orders[0].id).toBe(deliveredOrderId);
    });

    it('rejects DRAFT as a filter value -- never a placed status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders?status=DRAFT`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(400);
    });
  });

  describe('GET /orders/:id', () => {
    it('rejects with no token', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders/${pendingOrderId}`)
        .expect(401);
    });

    it('returns the full detail with items and status history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders/${pendingOrderId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(200);
      const { order } = res.body;
      expect(order.id).toBe(pendingOrderId);
      expect(order.status).toBe('PENDING_PICKUP');
      expect(order.items).toHaveLength(2);
      expect(order.deliveryCommune).toBe('Cocody');
      expect(order.statusHistory).toHaveLength(1);
      expect(order.statusHistory[0].fromStatus).toBe('DRAFT');
      expect(order.statusHistory[0].toStatus).toBe('PENDING_PICKUP');
    });

    it('returns two history rows for a cancelled order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders/${cancelledOrderId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('CANCELLED');
      expect(res.body.order.statusHistory).toHaveLength(2);
      expect(res.body.order.statusHistory[1].toStatus).toBe('CANCELLED');
    });

    it('never returns a DRAFT order (IDOR-adjacent -- the cart is not a placed order)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders/${draftOrderId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(404);
    });

    it("never lets one account read another account's order (IDOR)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders/${userBOrderId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(404);
    });

    it('returns 404 for an id that does not exist at all', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/orders/does-not-exist`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send();
      expect(res.status).toBe(404);
    });
  });
});
