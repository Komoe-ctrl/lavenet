import { z } from 'zod';

// F-CMD-04: public reference data (like /agencies) -- the checkout tunnel
// fetches the upcoming slot list once to render the picker. seatsAvailable
// is capacity - bookedCount; nothing is ever actually booked before
// checkout (increment 4), so it equals capacity for every row today, but
// the field exists now so the picker never has to change shape later.
export const timeSlotSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  capacity: z.number().int().positive(),
  seatsAvailable: z.number().int().nonnegative(),
});
export type TimeSlot = z.infer<typeof timeSlotSchema>;

export const slotsResponseSchema = z.object({ slots: z.array(timeSlotSchema) });
export type SlotsResponse = z.infer<typeof slotsResponseSchema>;

// pickupSlotId is only meaningful for HOME pickup (AGENCY uses
// agencyDropoffDate, F-CMD-03) -- not a discriminated union like
// setPickupModeSchema because that consistency check needs the order's
// saved pickupType, which isn't part of this request body; enforced in
// the service instead (cart.service.ts).
export const setSlotsSchema = z.object({
  pickupSlotId: z.string().min(1).optional(),
  deliverySlotId: z.string('Créneau de livraison requis.').min(1, 'Créneau de livraison requis.'),
});
export type SetSlotsInput = z.infer<typeof setSlotsSchema>;
