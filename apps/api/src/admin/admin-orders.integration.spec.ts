import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { OrderStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { env } from '../config/env';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP + real database, own throwaway fixtures (same convention as
// orders-history.integration.spec.ts). F-ADM-02: the first admin surface
// in this API -- role enforcement (ADMIN/STAFF only, RolesGuard) and every
// status transition the state machine allows/forbids are the point this
// file exists to prove.
describe('Admin orders (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let adminUser: { id: string };
  let staffUser: { id: string };
  let clientUser: { id: string; phone: string };
  let tokenAdmin: string;
  let tokenStaff: string;
  let tokenClient: string;

  const categoryId = `cat-admin-orders-test-${runId}`;
  const serviceId = `svc-admin-orders-test-${runId}`;

  let draftOrderId: string;
  let pendingOrderId: string;
  let processingOrderId: string;
  let deliveredOrderId: string;
  let raceOrderId: string;

  function signToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  async function createOrder(opts: { status: OrderStatus; reference: string; createdAt: Date }) {
    const order = await prisma.order.create({
      data: {
        userId: clientUser.id,
        status: opts.status,
        reference: opts.reference,
        createdAt: opts.createdAt,
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
        items: {
          create: [{ serviceId, quantity: 2, unitPriceXof: 1200, instructions: null }],
        },
      },
    });
    if (opts.status !== 'DRAFT') {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: 'DRAFT',
          toStatus: 'PENDING_PICKUP',
          actorId: clientUser.id,
        },
      });
    }
    return order.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hash(PASSWORD);

    adminUser = await prisma.user.create({
      data: {
        fullName: 'Admin Test',
        email: `admin-orders-admin-${runId}@lavenet.test`,
        phone: `+22535${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'ADMIN',
      },
    });
    staffUser = await prisma.user.create({
      data: {
        fullName: 'Staff Test',
        email: `admin-orders-staff-${runId}@lavenet.test`,
        phone: `+22536${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'STAFF',
      },
    });
    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Test',
        email: `admin-orders-client-${runId}@lavenet.test`,
        phone: `+22537${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenAdmin = signToken(adminUser.id, 'ADMIN');
    tokenStaff = signToken(staffUser.id, 'STAFF');
    tokenClient = signToken(clientUser.id, 'CLIENT');

    await prisma.serviceCategory.create({
      data: {
        id: categoryId,
        slug: `lavage-admin-orders-test-${runId}`,
        name: 'Lavage (test)',
        position: 999,
      },
    });
    await prisma.service.create({
      data: {
        id: serviceId,
        categoryId,
        slug: `lavage-au-kilo-admin-orders-test-${runId}`,
        name: 'Lavage au kilo (test)',
        unit: 'KG',
        processingHours: 24,
      },
    });

    draftOrderId = await createOrder({
      status: 'DRAFT',
      reference: `LN-TEST-${runId}-DRAFT`,
      createdAt: new Date(),
    });
    pendingOrderId = await createOrder({
      status: 'PENDING_PICKUP',
      reference: `LN-TEST-${runId}-PENDING`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    });
    processingOrderId = await createOrder({
      status: 'PROCESSING',
      reference: `LN-TEST-${runId}-PROCESSING`,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    });
    deliveredOrderId = await createOrder({
      status: 'DELIVERED',
      reference: `LN-TEST-${runId}-DELIVERED`,
      createdAt: new Date(),
    });
    raceOrderId = await createOrder({
      status: 'PROCESSING',
      reference: `LN-TEST-${runId}-RACE`,
      createdAt: new Date(),
    });
  }, 30_000);

  afterAll(async () => {
    const userIds = [adminUser.id, staffUser.id, clientUser.id];
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  describe('GET /admin/orders', () => {
    it('rejects with no token', async () => {
      await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/admin/orders`).expect(401);
    });

    it('rejects a CLIENT token with 403 -- role check, not IDOR masking', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders`)
        .set('Authorization', `Bearer ${tokenClient}`)
        .expect(403);
    });

    it('allows ADMIN, excludes DRAFT, includes client identity', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders?reference=${runId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send();
      expect(res.status).toBe(200);
      const ids = res.body.orders.map((o: { id: string }) => o.id);
      expect(ids).not.toContain(draftOrderId);
      expect(ids).toContain(pendingOrderId);
      const pendingRow = res.body.orders.find((o: { id: string }) => o.id === pendingOrderId);
      expect(pendingRow.clientName).toBe('Client Test');
    });

    it('allows STAFF too', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders`)
        .set('Authorization', `Bearer ${tokenStaff}`)
        .expect(200);
    });

    it('filters by status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders?reference=${runId}&status=DELIVERED`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send();
      expect(res.status).toBe(200);
      const ids = res.body.orders.map((o: { id: string }) => o.id);
      expect(ids).toEqual([deliveredOrderId]);
    });

    it('paginates with the requested page size', async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders?reference=${runId}&page=1&pageSize=2`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.orders.length).toBeLessThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(4);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(2);
    });
  });

  describe('GET /admin/orders/:id', () => {
    it('rejects a CLIENT token with 403', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders/${pendingOrderId}`)
        .set('Authorization', `Bearer ${tokenClient}`)
        .expect(403);
    });

    it('never returns a DRAFT order', async () => {
      await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders/${draftOrderId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(404);
    });

    it("returns any client's order with their identity attached", async () => {
      const res = await request(app.getHttpServer())
        .get(`/${API_GLOBAL_PREFIX}/admin/orders/${pendingOrderId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.order.clientName).toBe('Client Test');
      expect(res.body.order.clientPhone).toBe(clientUser.phone);
    });
  });

  describe('PATCH /admin/orders/:id/status', () => {
    it('rejects a CLIENT token with 403', async () => {
      await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${pendingOrderId}/status`)
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ toStatus: 'PICKED_UP' })
        .expect(403);
    });

    it('applies a legal transition and records it in history with the admin as actor', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${pendingOrderId}/status`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ toStatus: 'PICKED_UP' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('PICKED_UP');

      const history = await prisma.orderStatusHistory.findFirst({
        where: { orderId: pendingOrderId, toStatus: 'PICKED_UP' },
      });
      expect(history?.actorId).toBe(adminUser.id);
    });

    it('rejects a transition the state machine forbids', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${deliveredOrderId}/status`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ toStatus: 'PROCESSING' });
      expect(res.status).toBe(400);
    });

    it('rejects ON_HOLD with no reason', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${processingOrderId}/status`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ toStatus: 'ON_HOLD' });
      expect(res.status).toBe(400);
    });

    it('accepts ON_HOLD with a reason and records it', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${processingOrderId}/status`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ toStatus: 'ON_HOLD', reason: 'Article manquant' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('ON_HOLD');
      const lastEntry = res.body.order.statusHistory.at(-1);
      expect(lastEntry.reason).toBe('Article manquant');
    });

    it('STAFF can also transition an order', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${processingOrderId}/status`)
        .set('Authorization', `Bearer ${tokenStaff}`)
        .send({ toStatus: 'PROCESSING' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('PROCESSING');
    });

    it('reports a conflict when two admins race the same transition', async () => {
      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${raceOrderId}/status`)
          .set('Authorization', `Bearer ${tokenAdmin}`)
          .send({ toStatus: 'READY' }),
        request(app.getHttpServer())
          .patch(`/${API_GLOBAL_PREFIX}/admin/orders/${raceOrderId}/status`)
          .set('Authorization', `Bearer ${tokenStaff}`)
          .send({ toStatus: 'READY' }),
      ]);
      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });
});
