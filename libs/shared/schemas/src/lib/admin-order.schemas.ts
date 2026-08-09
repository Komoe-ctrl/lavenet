import { z } from 'zod';
import { orderDetailSchema, orderListItemSchema, placedOrderStatusSchema } from './order.schemas';

// F-ADM-02. "Liste filtrable (statut, date), recherche par référence" --
// query params always arrive as strings, hence z.coerce on the numeric
// pagination fields (no other listing endpoint in this API paginates yet,
// so there's no existing precedent to match beyond this).
export const adminListOrdersQuerySchema = z.object({
  status: placedOrderStatusSchema.optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  reference: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuerySchema>;

// Same row as orderListItemSchema, plus who the order belongs to -- the
// client's own list never needs this (it's always "my orders"), the admin
// list always does.
export const adminOrderListItemSchema = orderListItemSchema.extend({
  clientName: z.string().nullable(),
  clientPhone: z.string(),
});
export type AdminOrderListItem = z.infer<typeof adminOrderListItemSchema>;

export const adminOrderListResponseSchema = z.object({
  orders: z.array(adminOrderListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type AdminOrderListResponse = z.infer<typeof adminOrderListResponseSchema>;

export const adminOrderDetailSchema = orderDetailSchema.extend({
  clientName: z.string().nullable(),
  clientPhone: z.string(),
  clientEmail: z.string().nullable(),
});
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

export const adminOrderDetailResponseSchema = z.object({ order: adminOrderDetailSchema });
export type AdminOrderDetailResponse = z.infer<typeof adminOrderDetailResponseSchema>;

// F-STA-01/02. toStatus is never DRAFT -- not a legal target of any
// transition in the state machine (order-state-machine.ts's TRANSITIONS),
// so the narrower placedOrderStatusSchema is accurate, not just convenient.
// reason is validated as present-and-non-blank here; whether it's actually
// *required* for this particular toStatus (ON_HOLD) is enforced by
// requiresReason(), checked in the service against the state machine, not
// something zod alone can express (it depends on another field's value).
export const adminUpdateOrderStatusSchema = z.object({
  toStatus: placedOrderStatusSchema,
  reason: z.string().trim().min(1).optional(),
});
export type AdminUpdateOrderStatus = z.infer<typeof adminUpdateOrderStatusSchema>;
