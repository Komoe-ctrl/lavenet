import { z } from 'zod';
import { otpCodeSchema } from './auth.schemas';
import { placedOrderStatusSchema } from './order.schemas';

// F-LIV-03. One row per delivery in "ma tournée du jour" -- deliberately
// not the full AdminOrderDetail/OrderDetail shape (items, invoice, status
// history): a courier standing at a door needs exactly the four things the
// cahier lists (adresse, téléphone, montant à encaisser) plus enough to
// sort/identify the stop, nothing else.
export const courierDeliveryItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  clientName: z.string().nullable(),
  clientPhone: z.string(),
  deliveryCommune: z.string(),
  deliveryQuartier: z.string(),
  deliveryDetails: z.string(),
  deliverySlotStartsAt: z.iso.datetime().nullable(),
  deliverySlotEndsAt: z.iso.datetime().nullable(),
  // null = nothing to collect (paid in advance via Mobile Money) --
  // distinct from 0, which never actually occurs but would otherwise read
  // as "collect zero" rather than "not this courier's problem".
  amountDueXof: z.number().int().nonnegative().nullable(),
});
export type CourierDeliveryItem = z.infer<typeof courierDeliveryItemSchema>;

export const courierTourResponseSchema = z.object({
  deliveries: z.array(courierDeliveryItemSchema),
});
export type CourierTourResponse = z.infer<typeof courierTourResponseSchema>;

export const confirmDeliverySchema = z.object({ otpCode: otpCodeSchema });
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;

// F-LIV-05. reason is unconditionally required here (unlike
// adminUpdateOrderStatusSchema's, which depends on toStatus) -- every path
// through this endpoint is the same incident.
export const markClientAbsentSchema = z.object({
  reason: z.string().trim().min(1, 'Un motif est requis.'),
  newDeliverySlotId: z.string().min(1, 'Un nouveau créneau est requis.'),
});
export type MarkClientAbsentInput = z.infer<typeof markClientAbsentSchema>;

export const courierActionResponseSchema = z.object({
  orderId: z.string(),
  status: placedOrderStatusSchema,
});
export type CourierActionResponse = z.infer<typeof courierActionResponseSchema>;
