// F-CMD-07. Pure formatting only -- the actual number comes from
// `order_reference_seq` (Postgres sequence, prisma/migrations), consumed by
// the checkout transaction and passed in here already resolved. Kept
// separate from that DB call so the format itself (padding, year) is
// testable without a database.
export function formatOrderReference(sequenceNumber: number, year: number): string {
  return `LN-${year}-${String(sequenceNumber).padStart(6, '0')}`;
}
