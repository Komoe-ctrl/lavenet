import { formatInvoiceNumber } from './invoice-number';

describe('formatInvoiceNumber', () => {
  it('pads the sequence number to 6 digits', () => {
    expect(formatInvoiceNumber(42, 2026)).toBe('LN-FAC-2026-000042');
  });

  it('never truncates a sequence number wider than 6 digits', () => {
    expect(formatInvoiceNumber(1_234_567, 2026)).toBe('LN-FAC-2026-1234567');
  });

  it('uses the year passed in, not the current year', () => {
    expect(formatInvoiceNumber(1, 2030)).toBe('LN-FAC-2030-000001');
  });
});
