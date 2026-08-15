// F-PAY-05. Pure formatting only -- the actual number comes from
// InvoiceCounter (prisma/schema.prisma), incremented under a row lock in
// the same transaction as the Invoice it numbers (CLAUDE.md §4 rule 5: zero
// gaps, which is why this is a locked counter row and not a Postgres
// SEQUENCE -- see the model's comment). Kept separate from that DB call so
// the format itself is testable without a database, same convention as
// order-reference.ts's formatOrderReference.
export function formatInvoiceNumber(sequenceNumber: number, year: number): string {
  return `LN-FAC-${year}-${String(sequenceNumber).padStart(6, '0')}`;
}
