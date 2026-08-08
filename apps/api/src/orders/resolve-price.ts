import { resolveActivePriceRule } from '@lavenet/shared-domain';

export interface PriceRuleRecord {
  articleTypeId: string | null;
  amountXof: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

// Shared by CartService (live price on every cart read) and CheckoutService
// (the fresh, checkout-instant price frozen into OrderItem.unitPriceXof,
// CLAUDE.md §4 rule 2) -- same resolution, two different moments to
// resolve it at.
export function resolvePriceForArticleType(
  service: { priceRules: PriceRuleRecord[] },
  articleTypeId: string | null,
): PriceRuleRecord | undefined {
  const rules = service.priceRules.filter((rule) => rule.articleTypeId === articleTypeId);
  return resolveActivePriceRule(rules);
}
