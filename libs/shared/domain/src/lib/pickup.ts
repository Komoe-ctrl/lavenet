// F-CMD-03: an agency drop-off date is a calendar date only, no
// time-of-day -- Abidjan sits at UTC+0 with no DST, so comparing at UTC
// midnight is exactly comparing local calendar dates, no timezone
// conversion needed. Reused by increment 3 (resolveMinDeliverySlot anchors
// off this same date for AGENCY pickups, per the amendment that the
// delivery minimum can't be computed from checkout time).
export function isPastDropoffDate(date: Date, now: Date = new Date()): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return target < today;
}
