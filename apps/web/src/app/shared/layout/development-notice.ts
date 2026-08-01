import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-development-notice',
  templateUrl: './development-notice.html',
  styleUrl: './development-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevelopmentNotice {}
