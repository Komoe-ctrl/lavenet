import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface PageMetaOptions {
  title: string;
  description: string;
  /** Route path, e.g. '/' or '/tarifs' -- used to build an absolute og:url. */
  path: string;
  /** Absolute-from-root path under public/, e.g. '/images/og-image.webp'. */
  image?: string;
}

const DEFAULT_IMAGE = '/images/og-image.webp';

// Both public pages are prerendered, so these land in the static HTML a
// crawler actually fetches -- no JS execution required for link previews.
export function setPageMeta(
  titleService: Title,
  metaService: Meta,
  { title, description, path, image = DEFAULT_IMAGE }: PageMetaOptions,
): void {
  const url = `${environment.siteUrl}${path}`;
  const imageUrl = `${environment.siteUrl}${image}`;

  titleService.setTitle(title);
  metaService.updateTag({ name: 'description', content: description });
  metaService.updateTag({ property: 'og:type', content: 'website' });
  metaService.updateTag({ property: 'og:title', content: title });
  metaService.updateTag({ property: 'og:description', content: description });
  metaService.updateTag({ property: 'og:image', content: imageUrl });
  // Explicit type/dimensions so a crawler doesn't need to download the
  // image first to decide whether/how to use it.
  metaService.updateTag({ property: 'og:image:type', content: 'image/webp' });
  metaService.updateTag({ property: 'og:image:width', content: '1200' });
  metaService.updateTag({ property: 'og:image:height', content: '630' });
  metaService.updateTag({ property: 'og:url', content: url });
  metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
}
