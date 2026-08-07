import { z } from 'zod';

// F-CMD-03: the discriminated union is the enforcement point -- HOME can
// never carry agencyId/agencyDropoffDate, AGENCY always must, and the
// invalid combinations (e.g. HOME + agencyId) never even parse, instead of
// being accepted and silently ignored deep in the service layer.
// agencyDropoffDate is a pure calendar date ("YYYY-MM-DD"), no time-of-day
// -- there is no slot/capacity for an agency drop-off (no courier is
// mobilized), see prisma/schema.prisma's Order.agencyDropoffDate comment.
export const setPickupModeSchema = z.discriminatedUnion('pickupType', [
  z.object({ pickupType: z.literal('HOME') }),
  z.object({
    pickupType: z.literal('AGENCY'),
    agencyId: z.string().min(1, 'Agence requise.'),
    agencyDropoffDate: z.iso.date('Date de dépôt invalide.'),
  }),
]);
export type SetPickupModeInput = z.infer<typeof setPickupModeSchema>;
