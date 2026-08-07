// CLAUDE.md §4 rule 1: money is always an Int of XOF, no sub-unit --
// formatting only, no rounding/arithmetic decision here. Shared so the web
// (MoneyPipe, business-config display notes) and the API (lot 3 checkout
// totals) never reimplement the same Intl.NumberFormat call.
const FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatXof(amountXof: number): string {
  return `${FORMATTER.format(amountXof)} FCFA`;
}
