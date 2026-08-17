import { describe, expect, it } from 'vitest';
import {
  listOrdersQuerySchema,
  orderDetailSchema,
  orderListItemSchema,
  orderSchema,
  orderStatusHistoryEntrySchema,
} from './order.schemas';

function validOrder() {
  return {
    id: 'ord_1',
    reference: 'LN-2026-000142',
    status: 'PENDING_PICKUP',
    items: [
      {
        id: 'item_1',
        serviceId: 'svc_1',
        serviceName: 'Lavage au kilo',
        unit: 'KG',
        articleTypeId: null,
        articleTypeName: null,
        quantity: 2,
        instructions: null,
        unitPriceXof: 1200,
        lineTotalXof: 2400,
      },
    ],
    subtotalXof: 2400,
    discountXof: 0,
    deliveryFeeXof: 1000,
    vatRateBps: 0,
    vatAmountXof: 0,
    totalXof: 3400,
    pickupType: 'HOME',
    agencyId: null,
    agencyDropoffDate: null,
    pickupSlotId: 'slot_1',
    deliverySlotId: 'slot_2',
    deliveryCommune: 'Cocody',
    deliveryQuartier: 'Angré',
    deliveryDetails: 'Portail bleu, 2e étage',
    deliveryGeoLat: null,
    deliveryGeoLng: null,
    createdAt: '2026-08-08T10:00:00.000Z',
    // Ignored by orderSchema (extra keys are stripped, not rejected) --
    // required by orderDetailSchema below, which is why this lives in the
    // shared helper rather than only the describe block that needs it.
    payment: null,
    invoice: null,
  };
}

describe('orderSchema', () => {
  it('accepts a valid HOME order', () => {
    expect(orderSchema.safeParse(validOrder()).success).toBe(true);
  });

  it('accepts a valid AGENCY order (no pickupSlotId)', () => {
    const result = orderSchema.safeParse({
      ...validOrder(),
      pickupType: 'AGENCY',
      agencyId: 'agy_1',
      agencyDropoffDate: '2026-08-09',
      pickupSlotId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a negative unitPriceXof -- checkout never freezes a negative price', () => {
    const order = validOrder();
    order.items[0].unitPriceXof = -1;
    expect(orderSchema.safeParse(order).success).toBe(false);
  });

  it('rejects any status other than PENDING_PICKUP', () => {
    const result = orderSchema.safeParse({ ...validOrder(), status: 'DRAFT' });
    expect(result.success).toBe(false);
  });
});

describe('orderStatusHistoryEntrySchema', () => {
  it('accepts fromStatus DRAFT (the checkout row)', () => {
    const result = orderStatusHistoryEntrySchema.safeParse({
      fromStatus: 'DRAFT',
      toStatus: 'PENDING_PICKUP',
      reason: null,
      createdAt: '2026-08-08T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects toStatus DRAFT -- a placed order is never DRAFT', () => {
    const result = orderStatusHistoryEntrySchema.safeParse({
      fromStatus: 'PENDING_PICKUP',
      toStatus: 'DRAFT',
      reason: null,
      createdAt: '2026-08-08T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a reason (ON_HOLD)', () => {
    const result = orderStatusHistoryEntrySchema.safeParse({
      fromStatus: 'PROCESSING',
      toStatus: 'ON_HOLD',
      reason: 'Article manquant',
      createdAt: '2026-08-08T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('orderDetailSchema', () => {
  it('accepts any placed status, including CANCELLED and ON_HOLD', () => {
    const base = { ...validOrder(), statusHistory: [] };
    delete (base as Record<string, unknown>)['status'];
    for (const status of ['PICKED_UP', 'PROCESSING', 'READY', 'CANCELLED', 'ON_HOLD']) {
      expect(orderDetailSchema.safeParse({ ...base, status }).success).toBe(true);
    }
  });

  it('rejects DRAFT -- never returned by the history/detail endpoints', () => {
    const base = { ...validOrder(), statusHistory: [] };
    delete (base as Record<string, unknown>)['status'];
    const result = orderDetailSchema.safeParse({ ...base, status: 'DRAFT' });
    expect(result.success).toBe(false);
  });

  it('carries the full transition history', () => {
    const base = { ...validOrder(), statusHistory: [] };
    delete (base as Record<string, unknown>)['status'];
    const result = orderDetailSchema.safeParse({
      ...base,
      status: 'PICKED_UP',
      statusHistory: [
        {
          fromStatus: 'DRAFT',
          toStatus: 'PENDING_PICKUP',
          reason: null,
          createdAt: '2026-08-08T10:00:00.000Z',
        },
        {
          fromStatus: 'PENDING_PICKUP',
          toStatus: 'PICKED_UP',
          reason: null,
          createdAt: '2026-08-09T08:00:00.000Z',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('orderListItemSchema', () => {
  it('accepts a minimal list row', () => {
    const result = orderListItemSchema.safeParse({
      id: 'ord_1',
      reference: 'LN-2026-000142',
      status: 'DELIVERED',
      totalXof: 3400,
      itemsCount: 2,
      createdAt: '2026-08-08T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects status DRAFT', () => {
    const result = orderListItemSchema.safeParse({
      id: 'ord_1',
      reference: 'LN-2026-000142',
      status: 'DRAFT',
      totalXof: 3400,
      itemsCount: 2,
      createdAt: '2026-08-08T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('listOrdersQuerySchema', () => {
  it('accepts no filter', () => {
    expect(listOrdersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid status filter', () => {
    expect(listOrdersQuerySchema.safeParse({ status: 'PROCESSING' }).success).toBe(true);
  });

  it('rejects DRAFT as a filter -- never a placed status', () => {
    expect(listOrdersQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
  });
});
