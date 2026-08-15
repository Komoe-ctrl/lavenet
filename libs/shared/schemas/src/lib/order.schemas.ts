import { z } from 'zod';
import { invoiceSummarySchema } from './invoice.schemas';
import { paymentSchema } from './payment.schemas';

// F-STA-01/F-CMD-09. All 9 states, for OrderStatusHistory.fromStatus --
// the very first row's "from" is legitimately DRAFT (the checkout
// transition). No placed order (F-CMD-09's list/detail) is ever DRAFT
// itself, hence the narrower placedOrderStatusSchema below for
// order.status/history.toStatus.
export const orderStatusSchema = z.enum([
  'DRAFT',
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'ON_HOLD',
]);
export type OrderStatusValue = z.infer<typeof orderStatusSchema>;

export const placedOrderStatusSchema = z.enum([
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'ON_HOLD',
]);
export type PlacedOrderStatus = z.infer<typeof placedOrderStatusSchema>;

// F-CMD-05/07. Unlike cartItemSchema, unitPriceXof/lineTotalXof are never
// null here: this shape only ever describes a checked-out order, whose
// prices were frozen (CLAUDE.md §4 rule 2) precisely because every line was
// confirmed available at that instant -- an unavailable line rejects the
// whole checkout instead (cart.integration.spec.ts).
export const orderItemSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  unit: z.enum(['PIECE', 'KG']),
  articleTypeId: z.string().nullable(),
  articleTypeName: z.string().nullable(),
  quantity: z.number().int().positive(),
  instructions: z.string().nullable(),
  unitPriceXof: z.number().int().nonnegative(),
  lineTotalXof: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

// F-CMD-05/07. Every field below is frozen at checkout (CLAUDE.md §4 rule
// 2) and never changes again regardless of later F-STA transitions --
// shared as a plain shape (not a base schema) between orderSchema (the
// checkout response, status pinned to the one transition this endpoint can
// produce) and orderDetailSchema (F-CMD-09, any placed status). pickupType
// is a plain (non-nullable) z.enum here, unlike cartSchema's nullable
// union workaround -- checkout guarantees it's set, so the nullable-enum
// OpenAPI/ng-openapi-gen bug doesn't apply.
const orderCoreShape = {
  id: z.string(),
  reference: z.string(),
  items: z.array(orderItemSchema),
  subtotalXof: z.number().int().nonnegative(),
  discountXof: z.number().int().nonnegative(),
  deliveryFeeXof: z.number().int().nonnegative(),
  vatRateBps: z.number().int().nonnegative(),
  vatAmountXof: z.number().int().nonnegative(),
  totalXof: z.number().int().nonnegative(),
  pickupType: z.enum(['HOME', 'AGENCY']),
  agencyId: z.string().nullable(),
  agencyDropoffDate: z.iso.date().nullable(),
  pickupSlotId: z.string().nullable(),
  deliverySlotId: z.string(),
  deliveryCommune: z.string(),
  deliveryQuartier: z.string(),
  deliveryDetails: z.string(),
  deliveryGeoLat: z.number().nullable(),
  deliveryGeoLng: z.number().nullable(),
  createdAt: z.iso.datetime(),
};

// The response of POST /cart/checkout -- status is a literal, not the full
// enum: checkout is the only transition that endpoint can ever produce
// (DRAFT -> PENDING_PICKUP).
export const orderSchema = z.object({ ...orderCoreShape, status: z.literal('PENDING_PICKUP') });
export type Order = z.infer<typeof orderSchema>;

export const checkoutResponseSchema = z.object({ order: orderSchema });
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;

// F-STA-02. One row per transition -- fromStatus can be DRAFT (the
// checkout row), toStatus never can (a placed order is never DRAFT).
export const orderStatusHistoryEntrySchema = z.object({
  fromStatus: orderStatusSchema,
  toStatus: placedOrderStatusSchema,
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type OrderStatusHistoryEntry = z.infer<typeof orderStatusHistoryEntrySchema>;

// F-CMD-09 detail: same frozen fields as the checkout response, plus the
// current (possibly post-checkout) status and the full transition history
// the web's progression frise (F-STA-03) renders from.
export const orderDetailSchema = z.object({
  ...orderCoreShape,
  status: placedOrderStatusSchema,
  statusHistory: z.array(orderStatusHistoryEntrySchema),
  // Both null until the client initiates a payment / the order reaches
  // DELIVERED (F-PAY-01/05) -- never present on orderSchema (the checkout
  // response), which is always the very first instant of a placed order,
  // before either can exist.
  payment: paymentSchema.nullable(),
  invoice: invoiceSummarySchema.nullable(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const orderDetailResponseSchema = z.object({ order: orderDetailSchema });
export type OrderDetailResponse = z.infer<typeof orderDetailResponseSchema>;

// F-CMD-09 list: a lighter row per order -- no items/history, the detail
// endpoint is one click away for that.
export const orderListItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: placedOrderStatusSchema,
  totalXof: z.number().int().nonnegative(),
  itemsCount: z.number().int().positive(),
  createdAt: z.iso.datetime(),
});
export type OrderListItem = z.infer<typeof orderListItemSchema>;

export const orderListResponseSchema = z.object({ orders: z.array(orderListItemSchema) });
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;

// F-CMD-09 "filtrable par statut" -- optional, no filter means every
// placed status (DRAFT is never returned regardless).
export const listOrdersQuerySchema = z.object({ status: placedOrderStatusSchema.optional() });
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
