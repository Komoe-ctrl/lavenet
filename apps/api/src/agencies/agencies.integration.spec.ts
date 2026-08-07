import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP + real database, own throwaway agency (unique slug per run) so
// this suite never depends on or corrupts the demo seed. GET /agencies
// takes no Authorization header anywhere in this file -- public route.
describe('Agencies (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID().slice(0, 8);
  const agencyId = `agy-agencies-test-${runId}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.agency.create({
      data: {
        id: agencyId,
        slug: `agence-agencies-test-${runId}`,
        name: 'Agence (test)',
        address: 'Cocody (test)',
        openingHours: 'Lundi - Samedi, 8h - 18h',
      },
    });
  });

  afterAll(async () => {
    await prisma.agency.delete({ where: { id: agencyId } });
    await app.close();
  });

  it('returns the agency list with no Authorization header', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/agencies`);
    expect(res.status).toBe(200);
    expect(res.body.agencies).toEqual(
      expect.arrayContaining([
        {
          id: agencyId,
          name: 'Agence (test)',
          address: 'Cocody (test)',
          openingHours: 'Lundi - Samedi, 8h - 18h',
        },
      ]),
    );
  });
});
