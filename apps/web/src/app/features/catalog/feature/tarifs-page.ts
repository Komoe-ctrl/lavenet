import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CatalogService } from '../data-access/catalog.service';

// Public, prerendered (apps/web/src/app/app.routes.server.ts): the catalog
// fetch below runs at build time against the real API, not in the visitor's
// browser -- see docs/DETTE.md for the freshness tradeoff this implies.
@Component({
  selector: 'app-tarifs-page',
  imports: [MoneyPipe],
  templateUrl: './tarifs-page.html',
  styleUrl: './tarifs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarifsPage {
  private readonly catalogService = inject(CatalogService);

  protected readonly catalog = resource({
    loader: () => this.catalogService.loadCatalog(),
  });
}
