import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  // The Unsplash credit only makes sense where the photo is actually shown.
  readonly showPhotoCredit = input(false);
}
