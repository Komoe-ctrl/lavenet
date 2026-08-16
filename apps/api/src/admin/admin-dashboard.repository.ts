import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// F-ADM-01. CLAUDE.md §2's one sanctioned use of raw SQL: every query here
// is an aggregate that would otherwise mean loading every order into
// Node to sum/count/group in memory. All parameterized via Prisma.sql
// template interpolation (never string concatenation) -- injection-safe
// by construction, same as the invoice counter's row lock
// (orders.repository.ts).
//
// DRAFT is a cart, not a placed order, and is excluded from every query
// below the same way the admin order list already excludes it. CANCELLED
// stays in the status breakdown (an operational count) but is excluded
// from every money figure (revenue, average basket, top services) --
// nothing was ever collected on it.
//
// Postgres returns SUM()/COUNT() of integers as bigint, which the pg
// driver hands back as a string to avoid silent precision loss -- ::int
// casts in every query below sidestep that entirely rather than parsing
// strings back to numbers in TypeScript.
//
// "status NOT IN ('DRAFT', 'CANCELLED')" is repeated inline in each query
// below (against whichever table alias applies there) rather than shared
// as one Prisma.sql fragment -- splicing a fragment behind a table prefix
// like `o.${filter}` works (nested Prisma.sql fragments inline as literal
// SQL text, not as a parameter), but reads like a bug at a glance. Four
// short repeats of a self-explanatory clause is the more honest tradeoff.

export interface RevenueRow {
  todayXof: number;
  last7DaysXof: number;
  last30DaysXof: number;
}

export interface StatusCountRow {
  status: string;
  count: number;
}

export interface TopServiceRow {
  serviceId: string;
  serviceName: string;
  quantity: number;
  revenueXof: number;
}

export interface DailyRevenueRow {
  day: Date;
  revenueXof: number;
  orders: number;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(from: Date, days: number): Date {
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

@Injectable()
export class AdminDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRevenue(now: Date): Promise<RevenueRow> {
    const todayStart = startOfUtcDay(now);
    const last7Start = daysAgo(todayStart, 6);
    const last30Start = daysAgo(todayStart, 29);

    const [row] = await this.prisma.$queryRaw<RevenueRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM("totalXof") FILTER (WHERE "createdAt" >= ${todayStart}), 0)::int AS "todayXof",
        COALESCE(SUM("totalXof") FILTER (WHERE "createdAt" >= ${last7Start}), 0)::int AS "last7DaysXof",
        COALESCE(SUM("totalXof") FILTER (WHERE "createdAt" >= ${last30Start}), 0)::int AS "last30DaysXof"
      FROM "orders"
      WHERE status NOT IN ('DRAFT', 'CANCELLED')
    `);
    return row;
  }

  findStatusCounts(): Promise<StatusCountRow[]> {
    return this.prisma.$queryRaw<StatusCountRow[]>(Prisma.sql`
      SELECT status, COUNT(*)::int AS count
      FROM "orders"
      WHERE status != 'DRAFT'
      GROUP BY status
    `);
  }

  async findAverageBasket(now: Date): Promise<number> {
    const last30Start = daysAgo(startOfUtcDay(now), 29);
    const [row] = await this.prisma.$queryRaw<{ averageBasketXof: number }[]>(Prisma.sql`
      SELECT COALESCE(AVG("totalXof"), 0)::int AS "averageBasketXof"
      FROM "orders"
      WHERE status NOT IN ('DRAFT', 'CANCELLED') AND "createdAt" >= ${last30Start}
    `);
    return row.averageBasketXof;
  }

  findTopServices(now: Date, limit = 5): Promise<TopServiceRow[]> {
    const last30Start = daysAgo(startOfUtcDay(now), 29);
    return this.prisma.$queryRaw<TopServiceRow[]>(Prisma.sql`
      SELECT
        s.id AS "serviceId",
        s.name AS "serviceName",
        SUM(oi.quantity)::int AS quantity,
        SUM(oi."unitPriceXof" * oi.quantity)::int AS "revenueXof"
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi."orderId"
      JOIN "services" s ON s.id = oi."serviceId"
      WHERE o.status NOT IN ('DRAFT', 'CANCELLED')
        AND o."createdAt" >= ${last30Start}
        AND s."deletedAt" IS NULL
      GROUP BY s.id, s.name
      ORDER BY "revenueXof" DESC
      LIMIT ${limit}
    `);
  }

  findDailyRevenue(now: Date): Promise<DailyRevenueRow[]> {
    const last60Start = daysAgo(startOfUtcDay(now), 59);
    return this.prisma.$queryRaw<DailyRevenueRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', "createdAt")::date AS day,
        COALESCE(SUM("totalXof"), 0)::int AS "revenueXof",
        COUNT(*)::int AS orders
      FROM "orders"
      WHERE status NOT IN ('DRAFT', 'CANCELLED') AND "createdAt" >= ${last60Start}
      GROUP BY day
      ORDER BY day
    `);
  }
}
