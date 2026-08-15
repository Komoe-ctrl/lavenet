import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Same window shape as prisma/timeslot-data.ts (the one-time bootstrap seed
// for a fresh database, still used by `pnpm db:seed`) -- kept independent on
// purpose rather than shared, since that script isn't on apps/api's TS
// project graph. Four numbers duplicated is a smaller risk than wiring a
// cross-package import for it.
const WINDOW_DAYS = 21;
const CAPACITY = 5;
// [startHour, endHour) pairs, matching the agency's posted hours
// (prisma/agency-data.ts). Sunday is skipped ("fermé le dimanche").
const DAILY_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [8, 10],
  [10, 12],
  [14, 16],
  [16, 18],
];
const SUNDAY = 0;
// Trigger a top-up once fewer than this many days of coverage remain, not
// only once the window is literally empty -- leaves margin for a burst of
// concurrent requests to land before anyone ever sees a thin window.
const REFILL_THRESHOLD_DAYS = 14;

@Injectable()
export class SlotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Only ever future-facing: a slot whose window already started is never
  // worth offering, whether or not it has seats left.
  //
  // Replaces .github/workflows/reseed-slots.yml: that cron needed a repo
  // secret (PROD_DATABASE_URL) which was never actually configured, so
  // every scheduled and manual run failed the same way for ten days
  // straight. A real visitor's request is what triggers the top-up here --
  // never an external clock -- so the window can't go stale from a forgotten
  // setup step, and there's no secret, schedule or CI job left to fail.
  async findUpcoming(now: Date = new Date()) {
    await this.ensureWindowFilled(now);
    return this.prisma.timeSlot.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.timeSlot.findUnique({ where: { id } });
  }

  // Cheap on every call: one query against the (date, startsAt) unique
  // index. The write only runs once the window has genuinely thinned out,
  // which in steady state is at most once a day -- same cadence the cron
  // had, just triggered by traffic instead of a schedule.
  //
  // createMany + skipDuplicates rather than the old script's
  // findUnique-then-create loop: that loop was fine for a single serial
  // cron run but races under concurrent requests (two requests can both see
  // "missing" before either write lands). skipDuplicates lets Postgres
  // resolve the race via the unique constraint instead.
  private async ensureWindowFilled(now: Date): Promise<void> {
    const threshold = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + REFILL_THRESHOLD_DAYS),
    );
    const stillCovered = await this.prisma.timeSlot.findFirst({
      where: { date: { gte: threshold } },
      select: { id: true },
    });
    if (stillCovered) {
      return;
    }

    await this.prisma.timeSlot.createMany({
      data: buildWindowRows(now),
      skipDuplicates: true,
    });
  }
}

function buildWindowRows(now: Date) {
  const rows: { date: Date; startsAt: Date; endsAt: Date; capacity: number }[] = [];

  for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset += 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset),
    );
    if (date.getUTCDay() === SUNDAY) {
      continue;
    }

    for (const [startHour, endHour] of DAILY_WINDOWS) {
      rows.push({
        date,
        startsAt: new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startHour),
        ),
        endsAt: new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), endHour),
        ),
        capacity: CAPACITY,
      });
    }
  }

  return rows;
}
