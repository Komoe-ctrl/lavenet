import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Public, prerendered, zero API calls on load — the free-tier API can be
// completely asleep and this page still renders instantly (see
// docs/ADR/0003-cold-start-strategy.md).
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {}
