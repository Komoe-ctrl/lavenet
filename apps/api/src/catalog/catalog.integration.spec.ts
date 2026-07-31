import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP + real database, own throwaway fixtures (own category/service/
// article types/price rules, unique per run) so this suite never depends
// on or corrupts the demo seed. GET /catalog takes no Authorization header
// anywhere in this file -- it's a public route, that's the point.
describe('Catalog (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID().slice(0, 8);
  const categoryId = `cat-test-${runId}`;
  const kgServiceId = `svc-kg-${runId}`;
  const pieceServiceId = `svc-piece-${runId}`;
  const hiddenServiceId = `svc-hidden-${runId}`;
  const articleTypeId = `art-${runId}`;

  // Longer than the default 10s hook timeout: this fixture does more
  // sequential round trips (category, article type, 3 services each with
  // nested price rules) than the auth suite's, against a Neon dev branch
  // that may still be waking up.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.serviceCategory.create({
      data: { id: categoryId, slug: `lavage-test-${runId}`, name: 'Lavage (test)', position: 999 },
    });
    await prisma.articleType.create({
      data: { id: articleTypeId, name: 'Chemise (test)', iconKey: 'shirt' },
    });

    // KG service: single open-ended base rule (no articleType).
    await prisma.service.create({
      data: {
        id: kgServiceId,
        categoryId,
        slug: `lavage-au-kilo-test-${runId}`,
        name: 'Lavage au kilo (test)',
        unit: 'KG',
        processingHours: 24,
        priceRules: {
          create: [{ amountXof: 1200, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });

    // PIECE service: a real history for this article type -- an expired
    // rule superseded by the currently active one. This is what proves
    // F-CAT-05 (historized grid) rather than a flat single-row fixture.
    await prisma.service.create({
      data: {
        id: pieceServiceId,
        categoryId,
        slug: `repassage-test-${runId}`,
        name: 'Repassage (test)',
        unit: 'PIECE',
        processingHours: 48,
        priceRules: {
          create: [
            {
              articleTypeId,
              amountXof: 400,
              effectiveFrom: new Date('2025-01-01T00:00:00Z'),
              effectiveTo: new Date('2026-01-01T00:00:00Z'),
            },
            {
              articleTypeId,
              amountXof: 500,
              effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            },
          ],
        },
      },
    });

    // isActive: false -- must never appear in the public response.
    await prisma.service.create({
      data: {
        id: hiddenServiceId,
        categoryId,
        slug: `hidden-test-${runId}`,
        name: 'Service masqué (test)',
        unit: 'KG',
        processingHours: 24,
        isActive: false,
        priceRules: {
          create: [{ amountXof: 999, effectiveFrom: new Date('2026-01-01T00:00:00Z') }],
        },
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.priceRule.deleteMany({
      where: { serviceId: { in: [kgServiceId, pieceServiceId, hiddenServiceId] } },
    });
    await prisma.service.deleteMany({ where: { categoryId } });
    await prisma.articleType.delete({ where: { id: articleTypeId } });
    await prisma.serviceCategory.delete({ where: { id: categoryId } });
    await app.close();
  });

  it('is reachable with no Authorization header (public route)', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/catalog`);
    expect(res.status).toBe(200);
  });

  it('returns the KG service with its base price (no article type)', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/catalog`);
    const category = res.body.categories.find((c: { id: string }) => c.id === categoryId);
    const kgService = category.services.find((s: { id: string }) => s.id === kgServiceId);

    expect(kgService).toMatchObject({ unit: 'KG', processingHours: 24 });
    expect(kgService.prices).toEqual([
      { articleTypeId: null, articleTypeName: null, amountXof: 1200 },
    ]);
  });

  it('resolves the currently active price from a real history, not the expired one', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/catalog`);
    const category = res.body.categories.find((c: { id: string }) => c.id === categoryId);
    const pieceService = category.services.find((s: { id: string }) => s.id === pieceServiceId);

    expect(pieceService.prices).toEqual([
      { articleTypeId, articleTypeName: 'Chemise (test)', amountXof: 500 },
    ]);
  });

  it('excludes services with isActive: false', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/catalog`);
    const category = res.body.categories.find((c: { id: string }) => c.id === categoryId);

    expect(category.services.find((s: { id: string }) => s.id === hiddenServiceId)).toBeUndefined();
  });
});
