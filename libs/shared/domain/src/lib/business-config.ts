// Centralized business constants shared by the API (checkout totals,
// F-CMD-05) and the web (site-config's delivery notes, /tarifs) -- same
// "one source of truth" pattern as communes.ts. A figure must never be
// declared a second time in either app; import from here.
//
// Defaults follow docs/CAHIER-DES-CHARGES.md §5.3's own proposed default
// for the delivery fee (still marked "À VALIDER" there): a flat fee, free
// above a threshold. The minimum-order behavior (refuse home delivery
// below it, server-side, rather than silently charge extra) is documented
// in docs/ADR/0006-delivery-fee-and-minimum-order.md.
export const DELIVERY_FEE_XOF = 1000;
export const FREE_DELIVERY_THRESHOLD_XOF = 10_000;
export const MIN_ORDER_XOF = 2_000;

// F-CMD-05/docs/ADR/0007-checkout-vat.md: no VAT charged in V1 -- LaveNet is
// a demo business with no real tax registration. Kept as a named constant
// (not inlined as 0 in computeOrderTotals) so a future real rate is a
// one-line change, never a schema migration (CLAUDE.md §4 rule 1:
// vatRateBps/vatAmountXof are always frozen on the order, even at zero).
export const VAT_RATE_BPS = 0;
