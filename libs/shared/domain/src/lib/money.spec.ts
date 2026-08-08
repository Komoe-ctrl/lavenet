import { computeOrderTotals, formatXof } from './money';
import { DELIVERY_FEE_XOF, FREE_DELIVERY_THRESHOLD_XOF } from './business-config';

describe('formatXof', () => {
  it('formats with a thousands separator and the FCFA suffix', () => {
    // fr-FR groups thousands with a narrow no-break space (U+202F).
    expect(formatXof(1200)).toBe('1 200 FCFA');
  });

  it('formats zero without a sign', () => {
    expect(formatXof(0)).toBe('0 FCFA');
  });
});

describe('computeOrderTotals', () => {
  it('sums line totals into the subtotal', () => {
    const totals = computeOrderTotals([
      { unitPriceXof: 1000, quantity: 2 },
      { unitPriceXof: 500, quantity: 3 },
    ]);
    expect(totals.subtotalXof).toBe(3500);
  });

  it('charges the flat delivery fee below the free-delivery threshold', () => {
    const totals = computeOrderTotals([
      { unitPriceXof: FREE_DELIVERY_THRESHOLD_XOF - 1000, quantity: 1 },
    ]);
    expect(totals.deliveryFeeXof).toBe(DELIVERY_FEE_XOF);
  });

  it('waives the delivery fee at or above the free-delivery threshold', () => {
    const totals = computeOrderTotals([{ unitPriceXof: FREE_DELIVERY_THRESHOLD_XOF, quantity: 1 }]);
    expect(totals.deliveryFeeXof).toBe(0);
  });

  it('never applies a discount -- F-CMD-06 is not built yet', () => {
    const totals = computeOrderTotals([{ unitPriceXof: 1000, quantity: 1 }]);
    expect(totals.discountXof).toBe(0);
  });

  it('freezes a zero VAT rate and amount (docs/ADR/0007-checkout-vat.md)', () => {
    const totals = computeOrderTotals([{ unitPriceXof: 1000, quantity: 1 }]);
    expect(totals.vatRateBps).toBe(0);
    expect(totals.vatAmountXof).toBe(0);
  });

  it('totals subtotal minus discount plus delivery fee plus VAT', () => {
    const totals = computeOrderTotals([
      { unitPriceXof: FREE_DELIVERY_THRESHOLD_XOF - 1000, quantity: 1 },
    ]);
    expect(totals.totalXof).toBe(
      totals.subtotalXof - totals.discountXof + totals.deliveryFeeXof + totals.vatAmountXof,
    );
  });

  it('returns all-zero totals for an empty item list', () => {
    const totals = computeOrderTotals([]);
    expect(totals).toEqual({
      subtotalXof: 0,
      discountXof: 0,
      deliveryFeeXof: DELIVERY_FEE_XOF,
      vatRateBps: 0,
      vatAmountXof: 0,
      totalXof: DELIVERY_FEE_XOF,
    });
  });
});
