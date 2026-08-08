// Shared by CartService (agencyDropoffDate) and CheckoutService
// (agencyDropoffDate again, past checkout) -- a calendar date with no
// time-of-day, always UTC (Abidjan is UTC+0 with no DST, so this needs no
// conversion).
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
