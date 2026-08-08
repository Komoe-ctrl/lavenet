import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';
import { API_GLOBAL_PREFIX } from '../swagger.config';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP + real database, own throwaway slots (unique date per run) so
// this suite never depends on or corrupts the seeded rolling window. GET
// /slots takes no Authorization header anywhere in this file -- public
// route.
describe('Slots (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const runId = randomUUID().slice(0, 8);
  const futureSlotId = `slot-future-${runId}`;
  const pastSlotId = `slot-past-${runId}`;
  // Far enough in the future that no other test run's date collides with
  // it inside the same test database.
  const futureDate = new Date(Date.UTC(2099, 0, 15));
  const pastDate = new Date(Date.UTC(2020, 0, 15));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.timeSlot.create({
      data: {
        id: futureSlotId,
        date: futureDate,
        startsAt: new Date(Date.UTC(2099, 0, 15, 8)),
        endsAt: new Date(Date.UTC(2099, 0, 15, 10)),
        capacity: 5,
      },
    });
    await prisma.timeSlot.create({
      data: {
        id: pastSlotId,
        date: pastDate,
        startsAt: new Date(Date.UTC(2020, 0, 15, 8)),
        endsAt: new Date(Date.UTC(2020, 0, 15, 10)),
        capacity: 5,
      },
    });
  });

  afterAll(async () => {
    await prisma.timeSlot.deleteMany({ where: { id: { in: [futureSlotId, pastSlotId] } } });
    await app.close();
  });

  it('returns only future slots, with no Authorization header', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/slots`);
    expect(res.status).toBe(200);
    const ids: string[] = res.body.slots.map((slot: { id: string }) => slot.id);
    expect(ids).toContain(futureSlotId);
    expect(ids).not.toContain(pastSlotId);
  });

  it('reports full capacity as available (no bookings exist yet)', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_GLOBAL_PREFIX}/slots`);
    const slot = res.body.slots.find((s: { id: string }) => s.id === futureSlotId);
    expect(slot).toMatchObject({ capacity: 5, seatsAvailable: 5 });
  });
});
