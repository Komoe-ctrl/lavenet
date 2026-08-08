import { formatOrderReference } from './order-reference';

describe('formatOrderReference', () => {
  it('pads the sequence number to 6 digits', () => {
    expect(formatOrderReference(142, 2026)).toBe('LN-2026-000142');
  });

  it('never truncates a sequence number wider than 6 digits', () => {
    expect(formatOrderReference(1_234_567, 2026)).toBe('LN-2026-1234567');
  });

  it('uses the year passed in, not the current year', () => {
    expect(formatOrderReference(1, 2030)).toBe('LN-2030-000001');
  });
});
