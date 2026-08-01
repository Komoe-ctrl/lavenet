import { ChangeDetectionStrategy, Component } from '@angular/core';
import { siteConfig } from '../config/site-config';

@Component({
  selector: 'app-development-notice',
  templateUrl: './development-notice.html',
  styleUrl: './development-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevelopmentNotice {
  // Only point visitors to the footer's contact channels if at least one
  // actually exists -- otherwise this would promise a way to reach us that
  // isn't there yet.
  protected readonly hasContactChannel =
    siteConfig.contact.email !== null ||
    siteConfig.contact.phone !== null ||
    siteConfig.contact.whatsapp !== null;
}
