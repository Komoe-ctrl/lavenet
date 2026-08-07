import { Pipe, PipeTransform } from '@angular/core';
import { formatXof } from '@lavenet/shared-domain';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amountXof: number): string {
    return formatXof(amountXof);
  }
}
