import { z } from 'zod';
import { otpCodeSchema } from './auth.schemas';
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
  // F-LIV-02. Both null until a courier is assigned -- never assumed from
  // courierId alone (a deleted/renamed account would leave a dangling
  // name), always read together from the same join.
  courierId: z.string().nullable(),
  courierName: z.string().nullable(),
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
//
// otpCode: F-LIV-04. Same story -- zod can't know fromStatus here, so it
// only validates the *shape* if present; AdminOrdersService is what
// actually requires it for the OUT_FOR_DELIVERY -> DELIVERED transition.
export const adminUpdateOrderStatusSchema = z.object({
  toStatus: placedOrderStatusSchema,
  reason: z.string().trim().min(1).optional(),
  otpCode: otpCodeSchema.optional(),
});
export type AdminUpdateOrderStatus = z.infer<typeof adminUpdateOrderStatusSchema>;

// F-LIV-04. demoOtpCode: same convention as registerResponseSchema/
// otpResponseSchema -- present only when this call just generated one (the
// OUT_FOR_DELIVERY transition) and DEMO_MODE=true, absent every other time.
export const adminUpdateOrderStatusResponseSchema = adminOrderDetailResponseSchema.extend({
  demoOtpCode: z.string().optional(),
});
export type AdminUpdateOrderStatusResponse = z.infer<typeof adminUpdateOrderStatusResponseSchema>;

// F-LIV-02. courierId always required (there's no "unassign" flow in this
// lot) -- AdminOrdersService checks the target user actually has
// role=COURIER, zod can't express a DB-dependent constraint like that.
export const assignCourierSchema = z.object({
  courierId: z.string(),
});
export type AssignCourier = z.infer<typeof assignCourierSchema>;

// F-LIV-02. Feeds the assignment picker -- deliberately not a full
// "Livreurs" CRUD list (F-ADM-06, a separate lot), just enough to assign
// one to an order: id to submit, name/phone to tell two couriers apart.
export const adminCourierListItemSchema = z.object({
  id: z.string(),
  fullName: z.string().nullable(),
  phone: z.string(),
});
export type AdminCourierListItem = z.infer<typeof adminCourierListItemSchema>;

export const adminCourierListResponseSchema = z.object({
  couriers: z.array(adminCourierListItemSchema),
});
export type AdminCourierListResponse = z.infer<typeof adminCourierListResponseSchema>;
