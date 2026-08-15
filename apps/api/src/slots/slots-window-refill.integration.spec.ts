import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SlotsRepository } from './slots.repository';

// Real database, no mocked Prisma: the behaviour under test is exactly the
// interaction between the "is the window still covered" read and the
// createMany write, which a mock would have to reimplement to be worth
// anything (same reasoning as core/http/transfer-cache.integration.spec.ts
// on the web side).
//
// Anchored on a `now` far outside any date another test or the app's own
// rolling window ever touches, so this suite can create/delete freely
// without racing anything else that happens to run against the same
// database.
describe('SlotsRepository (on-demand window refill)', () => {
  let prisma: PrismaService;
  let repository: SlotsRepository;

  const anchor = new Date(Date.UTC(2150, 0, 4)); // a Monday

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SlotsRepository, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(SlotsRepository);
  });

  beforeEach(async () => {
    await prisma.timeSlot.deleteMany({ where: { date: { gte: anchor } } });
  });

  afterAll(async () => {
    await prisma.timeSlot.deleteMany({ where: { date: { gte: anchor } } });
    await prisma.$disconnect();
  });

  it('fills the full 21-day window (Sundays skipped) when nothing covers it yet', async () => {
    await repository.findUpcoming(anchor);

    const rows = await prisma.timeSlot.findMany({ where: { date: { gte: anchor } } });
    // 21 days, 3 Sundays in that span, 4 windows/day.
    expect(rows).toHaveLength((21 - 3) * 4);
    expect(rows.every((row) => row.capacity === 5)).toBe(true);
    expect(rows.some((row) => row.date.getUTCDay() === 0)).toBe(false);
  });

  it('does not rewrite rows once the window is already covered', async () => {
    await repository.findUpcoming(anchor);
    const first = await prisma.timeSlot.findMany({ where: { date: { gte: anchor } } });

    await repository.findUpcoming(anchor);
    const second = await prisma.timeSlot.findMany({ where: { date: { gte: anchor } } });

    expect(second).toHaveLength(first.length);
    expect(second.map((row) => row.id).sort()).toEqual(first.map((row) => row.id).sort());
  });

  it('tops up when the only existing row falls short of the refill threshold', async () => {
    // 5 days out: short of the 14-day threshold, so nothing covers the
    // window yet -- this alone must not read as "covered". A startsAt hour
    // (12:00) outside every generated window ([8,10]/[10,12]/[14,16]/[16,18])
    // so it can never collide with a row the top-up itself creates, keeping
    // the final count exact.
    const nearRow = new Date(Date.UTC(2150, 0, 9));
    await prisma.timeSlot.create({
      data: {
        date: nearRow,
        startsAt: new Date(Date.UTC(2150, 0, 9, 12)),
        endsAt: new Date(Date.UTC(2150, 0, 9, 13)),
        capacity: 5,
      },
    });

    await repository.findUpcoming(anchor);

    const rows = await prisma.timeSlot.findMany({ where: { date: { gte: anchor } } });
    // The pre-existing row, plus the full generated window.
    expect(rows).toHaveLength(1 + (21 - 3) * 4);
  });

  it('survives concurrent requests racing the same empty window without throwing', async () => {
    await expect(
      Promise.all([repository.findUpcoming(anchor), repository.findUpcoming(anchor)]),
    ).resolves.toBeDefined();

    const rows = await prisma.timeSlot.findMany({ where: { date: { gte: anchor } } });
    expect(rows).toHaveLength((21 - 3) * 4);
  });
});
