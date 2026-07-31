import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ColdStartService } from './cold-start.service';

@Component({
  selector: 'app-cold-start-banner',
  templateUrl: './cold-start-banner.html',
  styleUrl: './cold-start-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColdStartBanner {
  protected readonly coldStart = inject(ColdStartService);

  protected retry(): void {
    this.coldStart.retry();
  }
}
