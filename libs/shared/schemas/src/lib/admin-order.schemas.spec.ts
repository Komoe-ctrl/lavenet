import { describe, expect, it } from 'vitest';
import { adminListOrdersQuerySchema, adminUpdateOrderStatusSchema } from './admin-order.schemas';

describe('adminListOrdersQuerySchema', () => {
  it('defaults page/pageSize when omitted', () => {
    const result = adminListOrdersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('coerces page/pageSize from query-string values', () => {
    const result = adminListOrdersQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('rejects a pageSize above 100', () => {
    expect(adminListOrdersQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });

  it('rejects status DRAFT -- never a placed status', () => {
    expect(adminListOrdersQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
  });

  it('accepts a reference search term', () => {
    expect(adminListOrdersQuerySchema.safeParse({ reference: 'LN-2026' }).success).toBe(true);
  });
});

describe('adminUpdateOrderStatusSchema', () => {
  it('accepts a transition with no reason', () => {
    expect(adminUpdateOrderStatusSchema.safeParse({ toStatus: 'PICKED_UP' }).success).toBe(true);
  });

  it('accepts a transition with a reason', () => {
    const result = adminUpdateOrderStatusSchema.safeParse({
      toStatus: 'ON_HOLD',
      reason: 'Article manquant',
    });
    expect(result.success).toBe(true);
  });

  it('rejects toStatus DRAFT -- never a legal transition target', () => {
    expect(adminUpdateOrderStatusSchema.safeParse({ toStatus: 'DRAFT' }).success).toBe(false);
  });

  it('rejects a blank reason', () => {
    expect(
      adminUpdateOrderStatusSchema.safeParse({ toStatus: 'ON_HOLD', reason: '   ' }).success,
    ).toBe(false);
  });
});
