import { Injectable } from '@nestjs/common';
import type { AdminDashboardResponse, PlacedOrderStatus } from '@lavenet/shared-schemas';
import { AdminDashboardRepository, DailyRevenueRow } from './admin-dashboard.repository';

// F-ADM-01.
@Injectable()
export class AdminDashboardService {
  constructor(private readonly repo: AdminDashboardRepository) {}

  async get(now: Date = new Date()): Promise<AdminDashboardResponse> {
    const [revenue, statusCounts, averageBasketXof, topServices, dailyRevenue] =
      await Promise.all([
        this.repo.findRevenue(now),
        this.repo.findStatusCounts(),
        this.repo.findAverageBasket(now),
        this.repo.findTopServices(now),
        this.repo.findDailyRevenue(now),
      ]);

    return {
      revenue,
      statusCounts: statusCounts.map((row) => ({
        status: row.status as PlacedOrderStatus,
        count: row.count,
      })),
      averageBasketXof,
      topServices,
      dailyRevenue: fillDailyGaps(dailyRevenue, now),
    };
  }
}

// Postgres only ever returns a row for a day that actually had an order --
// a real line chart needs a continuous 60-point series, not gaps the
// caller has to interpret. Built from a plain UTC-day loop rather than
// trusting the DB rows to be contiguous.
function fillDailyGaps(
  rows: readonly DailyRevenueRow[],
  now: Date,
): AdminDashboardResponse['dailyRevenue'] {
  const byDate = new Map(rows.map((row) => [formatIsoDate(row.day), row]));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const points: AdminDashboardResponse['dailyRevenue'] = [];
  for (let offset = 59; offset >= 0; offset -= 1) {
    const day = new Date(todayStart);
    day.setUTCDate(day.getUTCDate() - offset);
    const date = formatIsoDate(day);
    const row = byDate.get(date);
    points.push({ date, revenueXof: row?.revenueXof ?? 0, orders: row?.orders ?? 0 });
  }
  return points;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
