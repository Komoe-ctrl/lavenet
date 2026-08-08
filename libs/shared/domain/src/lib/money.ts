import { DELIVERY_FEE_XOF, FREE_DELIVERY_THRESHOLD_XOF, VAT_RATE_BPS } from './business-config';

// CLAUDE.md §4 rule 1: money is always an Int of XOF, no sub-unit --
// formatting only, no rounding/arithmetic decision here. Shared so the web
// (MoneyPipe, business-config display notes) and the API (lot 3 checkout
// totals) never reimplement the same Intl.NumberFormat call.
const FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatXof(amountXof: number): string {
  return `${FORMATTER.format(amountXof)} FCFA`;
}

export interface OrderTotalsItemInput {
  unitPriceXof: number;
  quantity: number;
}

export interface OrderTotals {
  subtotalXof: number;
  // Always 0 -- F-CMD-06 (promo codes/loyalty points) isn't built yet. The
  // field exists now so checkout's total formula and Order's frozen columns
  // never need to change shape when that feature lands.
  discountXof: number;
  deliveryFeeXof: number;
  vatRateBps: number;
  vatAmountXof: number;
  totalXof: number;
}

// F-CMD-05. The one and only place a checkout total is computed -- the API
// calls this with each item's freshly-resolved (never cached) unit price at
// the checkout instant (CLAUDE.md §4 rule 2), the web calls it identically
// to preview the same figures before validating. Delivery fee is
// independent of pickup mode: a courier delivery leg happens whether the
// client dropped off at an agency or had a home pickup (docs/ADR/0006) --
// only the *minimum order* rule (checked separately, at checkout) is
// specific to HOME.
export function computeOrderTotals(items: readonly OrderTotalsItemInput[]): OrderTotals {
  const subtotalXof = items.reduce((sum, item) => sum + item.unitPriceXof * item.quantity, 0);
  const discountXof = 0;
  const deliveryFeeXof = subtotalXof >= FREE_DELIVERY_THRESHOLD_XOF ? 0 : DELIVERY_FEE_XOF;
  const vatRateBps = VAT_RATE_BPS;
  const vatAmountXof = Math.round(((subtotalXof - discountXof) * vatRateBps) / 10_000);
  const totalXof = subtotalXof - discountXof + deliveryFeeXof + vatAmountXof;
  return { subtotalXof, discountXof, deliveryFeeXof, vatRateBps, vatAmountXof, totalXof };
}
