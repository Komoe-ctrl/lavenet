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
import { AdminDashboardRepository } from './admin-dashboard.repository';
import { AdminDashboardService } from './admin-dashboard.service';

// Real HTTP for the guard, real repository/service instantiated directly
// (no HTTP layer, high LIMIT on top services) for the aggregate
// correctness -- the dashboard scans the *entire* orders table by design
// (it's a global business figure, never scoped to one test's own rows),
// so this shared dev database can hold other tests' real orders at the
// same time. Every money/count assertion below is a delta (dashboard
// state after creating fixtures, minus before), which holds regardless of
// whatever else exists in the table -- an exact assertion would be
// coincidentally right today and flaky the next time another suite runs
// alongside it.
describe('Admin dashboard (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let repo: AdminDashboardRepository;
  let service: AdminDashboardService;

  const PASSWORD = 'Integration1234!';
  const runId = randomUUID().slice(0, 8);
  const phoneDigits = Date.now().toString().slice(-8);
  let adminUser: { id: string };
  let clientUser: { id: string };
  let tokenAdmin: string;
  let tokenClient: string;

  const categoryId = `cat-dashboard-test-${runId}`;
  const serviceAId = `svc-dashboard-a-${runId}`;
  const serviceBId = `svc-dashboard-b-${runId}`;
  const orderIds: string[] = [];

  function signToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, { secret: env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }

  function daysAgo(days: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  }

  // Independent cross-check for findAverageBasket's raw SQL: the exact
  // same window and status filter, expressed through Prisma's own
  // aggregate() instead. If the raw query's WHERE ever drifted from this
  // (e.g. an off-by-one on the day boundary), this catches it -- comparing
  // against a hand-computed literal wouldn't, since the shared dev
  // database can hold other orders in the same window at test time.
  async function realAverageBasket30d(now: Date): Promise<number> {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 29);
    const agg = await prisma.order.aggregate({
      where: { status: { notIn: ['DRAFT', 'CANCELLED'] }, createdAt: { gte: start } },
      _sum: { totalXof: true },
      _count: true,
    });
    const sum = agg._sum.totalXof ?? 0;
    return agg._count > 0 ? Math.round(sum / agg._count) : 0;
  }

  async function createOrder(opts: {
    status: OrderStatus;
    createdAt: Date;
    totalXof: number;
    serviceId: string;
    quantity: number;
    unitPriceXof: number;
  }): Promise<string> {
    const order = await prisma.order.create({
      data: {
        userId: clientUser.id,
        status: opts.status,
        reference: `LN-TEST-${runId}-${randomUUID()}`,
        createdAt: opts.createdAt,
        pickupType: 'HOME',
        deliveryCommune: 'Cocody',
        deliveryQuartier: 'Angré',
        deliveryDetails: 'Portail bleu (test)',
        subtotalXof: opts.totalXof,
        discountXof: 0,
        deliveryFeeXof: 0,
        vatRateBps: 0,
        vatAmountXof: 0,
        totalXof: opts.totalXof,
        items: {
          create: [
            {
              serviceId: opts.serviceId,
              quantity: opts.quantity,
              unitPriceXof: opts.unitPriceXof,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);
    return order.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    repo = app.get(AdminDashboardRepository);
    service = app.get(AdminDashboardService);
    const passwordHash = await hash(PASSWORD);

    adminUser = await prisma.user.create({
      data: {
        fullName: 'Admin Test',
        email: `dashboard-admin-${runId}@lavenet.test`,
        phone: `+22541${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
        role: 'ADMIN',
      },
    });
    clientUser = await prisma.user.create({
      data: {
        fullName: 'Client Test',
        email: `dashboard-client-${runId}@lavenet.test`,
        phone: `+22542${phoneDigits}`,
        passwordHash,
        phoneVerifiedAt: new Date(),
      },
    });
    tokenAdmin = signToken(adminUser.id, 'ADMIN');
    tokenClient = signToken(clientUser.id, 'CLIENT');

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-dashboard-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.service.create({
      data: { id: serviceAId, categoryId, slug: `lavage-a-${runId}`, name: 'Service A (test)', unit: 'KG', processingHours: 24 },
    });
    await prisma.service.create({
      data: { id: serviceBId, categoryId, slug: `lavage-b-${runId}`, name: 'Service B (test)', unit: 'KG', processingHours: 24 },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, clientUser.id] } } });
    await app.close();
  });

  it('rejects a CLIENT token with 403', async () => {
    await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/dashboard`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .expect(403);
  });

  it('returns the expected shape for an ADMIN token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/${API_GLOBAL_PREFIX}/admin/dashboard`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.revenue).toHaveProperty('todayXof');
    expect(res.body.revenue).toHaveProperty('last7DaysXof');
    expect(res.body.revenue).toHaveProperty('last30DaysXof');
    expect(Array.isArray(res.body.statusCounts)).toBe(true);
    expect(Array.isArray(res.body.topServices)).toBe(true);
    expect(res.body.dailyRevenue).toHaveLength(60);
  });

  describe('aggregate correctness', () => {
    it('sums revenue by window, excluding DRAFT and CANCELLED, honoring soft-deleted services in the top-services ranking', async () => {
      const now = new Date();
      const before = await repo.findRevenue(now);
      const beforeStatuses = new Map(
        (await repo.findStatusCounts()).map((row) => [row.status, row.count]),
      );

      // Invisible everywhere: a cart, not a placed order.
      await createOrder({
        status: 'DRAFT',
        createdAt: now,
        totalXof: 999_999,
        serviceId: serviceAId,
        quantity: 1,
        unitPriceXof: 999_999,
      });
      // Counted in the status breakdown, excluded from every money figure.
      await createOrder({
        status: 'CANCELLED',
        createdAt: now,
        totalXof: 3_000,
        serviceId: serviceAId,
        quantity: 1,
        unitPriceXof: 3_000,
      });
      // Today, this week, this month, and this "before it was deactivated".
      await createOrder({
        status: 'DELIVERED',
        createdAt: now,
        totalXof: 2_000,
        serviceId: serviceAId,
        quantity: 2,
        unitPriceXof: 1_000,
      });
      await createOrder({
        status: 'PENDING_PICKUP',
        createdAt: daysAgo(3),
        totalXof: 1_500,
        serviceId: serviceBId,
        quantity: 1,
        unitPriceXof: 1_500,
      });
      await createOrder({
        status: 'PROCESSING',
        createdAt: daysAgo(20),
        totalXof: 4_000,
        serviceId: serviceAId,
        quantity: 1,
        unitPriceXof: 4_000,
      });
      // Outside the 30-day window (but inside 60) -- must not move revenue/
      // basket/top-services, but must appear in the daily curve.
      await createOrder({
        status: 'DELIVERED',
        createdAt: daysAgo(45),
        totalXof: 1_000,
        serviceId: serviceAId,
        quantity: 1,
        unitPriceXof: 1_000,
      });

      // Service B placed an order before being deactivated -- its revenue
      // must still count, but it must never appear in the ranking again.
      await prisma.service.update({ where: { id: serviceBId }, data: { deletedAt: new Date() } });

      const after = await repo.findRevenue(now);
      const afterStatuses = new Map(
        (await repo.findStatusCounts()).map((row) => [row.status, row.count]),
      );

      expect(after.todayXof - before.todayXof).toBe(2_000);
      expect(after.last7DaysXof - before.last7DaysXof).toBe(2_000 + 1_500);
      expect(after.last30DaysXof - before.last30DaysXof).toBe(2_000 + 1_500 + 4_000);

      // Cross-checked against an independent Prisma aggregate() over the
      // same window/filter, not a literal -- see realAverageBasket30d.
      const [rawBasket, crossCheckedBasket] = await Promise.all([
        repo.findAverageBasket(now),
        realAverageBasket30d(now),
      ]);
      expect(rawBasket).toBe(crossCheckedBasket);

      expect((afterStatuses.get('CANCELLED') ?? 0) - (beforeStatuses.get('CANCELLED') ?? 0)).toBe(1);
      expect(afterStatuses.has('DRAFT')).toBe(false);

      // High limit specifically so this assertion doesn't depend on how
      // service A/B rank against whatever else is in the shared dev DB.
      const topServices = await repo.findTopServices(now, 1000);
      const serviceA = topServices.find((row) => row.serviceId === serviceAId);
      const serviceB = topServices.find((row) => row.serviceId === serviceBId);
      expect(serviceA).toBeDefined();
      expect(serviceA?.revenueXof).toBe(2_000 + 4_000);
      expect(serviceB).toBeUndefined();
    });

    it('fills gaps in the 60-day series so every day appears exactly once, oldest first', async () => {
      const dashboard = await service.get(new Date());
      expect(dashboard.dailyRevenue).toHaveLength(60);
      const dates = dashboard.dailyRevenue.map((point) => point.date);
      expect(new Set(dates).size).toBe(60);
      expect([...dates].sort()).toEqual(dates);
    });
  });
});
