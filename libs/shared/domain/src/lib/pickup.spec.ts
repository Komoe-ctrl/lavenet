import { isPastDropoffDate } from './pickup';

const NOW = new Date('2026-08-07T18:30:00Z');

describe('isPastDropoffDate', () => {
  it('is false for today, regardless of the current time of day', () => {
    expect(isPastDropoffDate(new Date('2026-08-07T00:00:00Z'), NOW)).toBe(false);
  });

  it('is false for a future date', () => {
    expect(isPastDropoffDate(new Date('2026-08-08T00:00:00Z'), NOW)).toBe(false);
  });

  it('is true for yesterday', () => {
    expect(isPastDropoffDate(new Date('2026-08-06T00:00:00Z'), NOW)).toBe(true);
  });

  it('ignores the time-of-day component of both dates', () => {
    expect(isPastDropoffDate(new Date('2026-08-07T23:59:59Z'), NOW)).toBe(false);
  });
});
