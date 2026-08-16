import { z } from 'zod';
import { placedOrderStatusSchema } from './order.schemas';

// F-ADM-01. DRAFT is a cart, not a placed order -- excluded everywhere on
// this page the same way it already is from the admin order list
// (placedOrderStatusSchema, order.schemas.ts). CANCELLED stays in, as an
// operational count, but is excluded from every money figure below (no
// payment was ever collected on it).
export const dashboardRevenueSchema = z.object({
  todayXof: z.number().int().nonnegative(),
  last7DaysXof: z.number().int().nonnegative(),
  last30DaysXof: z.number().int().nonnegative(),
});
export type DashboardRevenue = z.infer<typeof dashboardRevenueSchema>;

export const dashboardStatusCountSchema = z.object({
  status: placedOrderStatusSchema,
  count: z.number().int().nonnegative(),
});
export type DashboardStatusCount = z.infer<typeof dashboardStatusCountSchema>;

// Ranked by revenue over the same 30-day window as last30DaysXof, not a
// separately configurable period -- one fewer figure to define and keep
// in sync. quantity rides along as the secondary number each row shows.
export const dashboardTopServiceSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  quantity: z.number().int().nonnegative(),
  revenueXof: z.number().int().nonnegative(),
});
export type DashboardTopService = z.infer<typeof dashboardTopServiceSchema>;

// One point per day, always 60 of them -- gaps (a day with zero orders)
// are filled with revenueXof/orders at 0 server-side, never left as a
// missing point a line chart would have to guess how to draw.
export const dashboardDailyPointSchema = z.object({
  date: z.iso.date(),
  revenueXof: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
});
export type DashboardDailyPoint = z.infer<typeof dashboardDailyPointSchema>;

export const adminDashboardResponseSchema = z.object({
  revenue: dashboardRevenueSchema,
  statusCounts: z.array(dashboardStatusCountSchema),
  averageBasketXof: z.number().int().nonnegative(),
  topServices: z.array(dashboardTopServiceSchema),
  dailyRevenue: z.array(dashboardDailyPointSchema),
});
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;
