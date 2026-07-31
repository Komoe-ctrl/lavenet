import { Pipe, PipeTransform } from '@angular/core';

// CLAUDE.md §4 rule 1: money is always an Int of XOF, no sub-unit — this
// pipe only formats for display, no rounding/arithmetic decision to make.
const FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amountXof: number): string {
    return `${FORMATTER.format(amountXof)} FCFA`;
  }
}
