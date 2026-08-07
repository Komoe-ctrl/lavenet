import type { PrismaClient } from '@prisma/client';

// F-CMD-04. Rolling demo data, unlike catalog-data.ts/agency-data.ts:
// back-office slot creation (F-LIV-01/F-ADM-05) is a separate, later lot,
// so until it exists this is the only source of TimeSlot rows. Generates a
// window starting from `now` (the day this script runs), not a fixed
// calendar range -- rerun periodically (same as a real back-office would
// create slots ahead of time) to keep the window populated; safe to rerun
// any time, existing rows are only ever updated in place (capacity), never
// duplicated (idempotent upsert by the (date, startsAt) unique
// constraint).
//
// Abidjan is UTC+0 with no DST, so an hour here is exactly that hour on
// the wire (no timezone conversion) -- 08:00 means 08:00 both in Postgres
// and for a client in Abidjan.
const WINDOW_DAYS = 21;
const CAPACITY = 5;
// [startHour, endHour) pairs, matching the agency's own posted hours
// (prisma/agency-data.ts) -- Sunday is skipped entirely, same "fermé le
// dimanche" assumption.
const DAILY_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [8, 10],
  [10, 12],
  [14, 16],
  [16, 18],
];
const SUNDAY = 0;

export interface SeedTimeSlotsResult {
  created: number;
  unchanged: number;
}

export async function seedTimeSlots(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<SeedTimeSlotsResult> {
  let created = 0;
  let unchanged = 0;

  for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset += 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset),
    );
    if (date.getUTCDay() === SUNDAY) {
      continue;
    }

    for (const [startHour, endHour] of DAILY_WINDOWS) {
      const startsAt = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startHour),
      );
      const endsAt = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), endHour),
      );

      const existing = await prisma.timeSlot.findUnique({
        where: { date_startsAt: { date, startsAt } },
      });
      if (existing) {
        unchanged += 1;
        continue;
      }

      await prisma.timeSlot.create({ data: { date, startsAt, endsAt, capacity: CAPACITY } });
      created += 1;
    }
  }

  return { created, unchanged };
}
