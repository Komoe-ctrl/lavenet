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

// F-PAY-05. Copied onto each Invoice at issuance (never read live at PDF
// render time, docs comment on the Invoice model) -- these three exist
// specifically for that document, not for the public site, which is why
// they don't live in apps/web/.../site-config.ts's siteConfig.contact
// (deliberately all `null` there: "no invented number or address").
// An invoice naming an unregistered legal entity is already a fiction this
// demo accepts (same as VAT_RATE_BPS above); reusing values that already
// exist elsewhere in the app rather than inventing new ones keeps that
// fiction consistent instead of compounding it:
//  - COMPANY_ADDRESS matches prisma/agency-data.ts's AGENCY.address exactly
//    (already shown to a real visitor mid-checkout, choosing AGENCY
//    drop-off) -- apps/web can't import prisma/, so this is a second
//    literal kept in sync by hand, same convention as site-config.ts's own
//    hoursNote comment.
//  - COMPANY_CONTACT reuses the @lavenet.ci domain already established for
//    demo accounts (prisma/demo-accounts-data.ts), not a phone number --
//    site-config.ts's own contact channels stay null regardless.
export const COMPANY_NAME = 'LaveNet';
export const COMPANY_ADDRESS = 'Cocody, Angré, Abidjan';
export const COMPANY_CONTACT = 'contact@lavenet.ci';
