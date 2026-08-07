// F-CMD-04: "le créneau de livraison doit être postérieur au créneau de
// retrait + délai de traitement du service le plus lent du panier"
// (CAHIER-DES-CHARGES.md §5.3). The pickup anchor differs by mode: HOME has
// a real capacity-limited TimeSlot, so the safe anchor is its *end* (the
// courier may collect any time within the window, so processing can't be
// assumed to start before the window closes). AGENCY has no slot at all
// (isPastDropoffDate, ./pickup.ts) -- per the same F-CMD-03 amendment, the
// anchor is the chosen agencyDropoffDate, end-of-day (23:59:59 UTC;
// Abidjan is UTC+0 with no DST, so this is also the local end of day):
// there is no known time-of-day for a walk-in drop-off, so the last
// instant of that calendar date is the only conservative choice available
// without inventing agency closing hours the data model doesn't capture.
export type PickupAnchor =
  { type: 'HOME'; slotEndsAt: Date } | { type: 'AGENCY'; dropoffDate: Date };

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

export function resolveMinDeliverySlot(pickup: PickupAnchor, slowestProcessingHours: number): Date {
  const anchor = pickup.type === 'HOME' ? pickup.slotEndsAt : endOfUtcDay(pickup.dropoffDate);
  return new Date(anchor.getTime() + slowestProcessingHours * 60 * 60 * 1000);
}
