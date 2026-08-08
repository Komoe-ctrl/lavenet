import { z } from 'zod';

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

// F-CMD-05/07. The response of POST /cart/checkout -- the DRAFT order,
// past the point every field below is frozen. status is a literal, not the
// full OrderStatus enum: checkout is the only transition this lot
// implements (DRAFT -> PENDING_PICKUP), the rest of the state machine
// (F-STA) is a separate, later lot (see prisma/schema.prisma's OrderStatus
// comment). pickupType is a plain (non-nullable) z.enum here, unlike
// cartSchema's nullable union workaround -- checkout guarantees it's set,
// so the nullable-enum OpenAPI/ng-openapi-gen bug doesn't apply.
export const orderSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.literal('PENDING_PICKUP'),
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
});
export type Order = z.infer<typeof orderSchema>;

export const checkoutResponseSchema = z.object({ order: orderSchema });
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
