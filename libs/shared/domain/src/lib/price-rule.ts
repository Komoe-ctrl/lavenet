// Pure price resolution: given the full historized set of PriceRule rows for
// a (service, articleType) pair (prisma/schema.prisma), pick the one active
// at a given instant. Used by the catalog API to show current prices
// (apps/api/src/catalog) and, unchanged, by the lot 3 checkout to snapshot
// OrderItem.unitPriceXof at order time (CLAUDE.md §4 rule 2) — the `at`
// parameter is what makes both use cases the same function.
export interface PriceRuleLike {
  amountXof: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

// Half-open interval [effectiveFrom, effectiveTo): a rule effective from a
// date is active on that exact instant; a rule closed at a date is no longer
// active on that exact instant, its successor is.
export function resolveActivePriceRule<T extends PriceRuleLike>(
  rules: readonly T[],
  at: Date = new Date(),
): T | undefined {
  const active = rules.filter(
    (rule) => rule.effectiveFrom <= at && (rule.effectiveTo === null || at < rule.effectiveTo),
  );

  if (active.length === 0) {
    return undefined;
  }

  // Defensive, not expected in well-formed data: if two rules somehow
  // overlap at `at`, the one that started most recently wins.
  return active.reduce((latest, rule) =>
    rule.effectiveFrom > latest.effectiveFrom ? rule : latest,
  );
}
