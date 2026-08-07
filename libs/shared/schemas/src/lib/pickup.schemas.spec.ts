import { describe, expect, it } from 'vitest';
import { setPickupModeSchema } from './pickup.schemas';

describe('setPickupModeSchema', () => {
  it('accepts HOME on its own', () => {
    expect(setPickupModeSchema.safeParse({ pickupType: 'HOME' }).success).toBe(true);
  });

  it('accepts AGENCY with an agencyId and a date-only agencyDropoffDate', () => {
    const result = setPickupModeSchema.safeParse({
      pickupType: 'AGENCY',
      agencyId: 'agy_1',
      agencyDropoffDate: '2026-08-10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects AGENCY without an agencyId', () => {
    const result = setPickupModeSchema.safeParse({
      pickupType: 'AGENCY',
      agencyDropoffDate: '2026-08-10',
    });
    expect(result.success).toBe(false);
  });

  it('rejects AGENCY without an agencyDropoffDate', () => {
    const result = setPickupModeSchema.safeParse({ pickupType: 'AGENCY', agencyId: 'agy_1' });
    expect(result.success).toBe(false);
  });

  it('rejects an agencyDropoffDate carrying a time component', () => {
    const result = setPickupModeSchema.safeParse({
      pickupType: 'AGENCY',
      agencyId: 'agy_1',
      agencyDropoffDate: '2026-08-10T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown pickupType', () => {
    expect(setPickupModeSchema.safeParse({ pickupType: 'OFFICE' }).success).toBe(false);
  });

  it('rejects a missing pickupType', () => {
    expect(setPickupModeSchema.safeParse({}).success).toBe(false);
  });
});
