import { ChangeDetectionStrategy, Component, inject, linkedSignal, resource } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { siteConfig } from '../../../shared/config/site-config';
import { DevelopmentNotice } from '../../../shared/layout/development-notice';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { setPageMeta } from '../../../shared/seo/set-page-meta';
import { CatalogService } from '../data-access/catalog.service';

// Public, prerendered (apps/web/src/app/app.routes.server.ts): the catalog
// fetch below runs at build time against the real API, not in the visitor's
// browser -- see docs/DETTE.md for the freshness tradeoff this implies.
@Component({
  selector: 'app-tarifs-page',
  imports: [MoneyPipe, SiteHeader, SiteFooter, DevelopmentNotice],
  templateUrl: './tarifs-page.html',
  styleUrl: './tarifs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarifsPage {
  private readonly catalogService = inject(CatalogService);

  protected readonly config = siteConfig;

  constructor() {
    setPageMeta(inject(Title), inject(Meta), {
      title: `Nos tarifs — ${siteConfig.brandName}`,
      description: `Grille tarifaire du pressing en ligne ${siteConfig.brandName} à Abidjan : lavage, repassage, par catégorie et type d’article.`,
      path: '/tarifs',
    });
  }

  protected readonly catalog = resource({
    loader: () => this.catalogService.loadCatalog(),
  });

  // resource() drops its value the moment a reload errors -- catalog.value()
  // throws in that state. This carries the last successfully loaded catalog
  // forward through any later loading/error state, so a background refresh
  // (in flight or failed) never blanks out prices already on screen.
  protected readonly lastGoodCatalog = linkedSignal<
    CatalogResponseDtoOutput | null,
    CatalogResponseDtoOutput | null
  >({
    source: () => (this.catalog.hasValue() ? this.catalog.value() : null),
    computation: (source, previous) => source ?? previous?.value ?? null,
  });
}
