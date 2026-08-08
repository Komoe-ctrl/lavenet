import { describe, expect, it } from 'vitest';
import { orderSchema } from './order.schemas';

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
