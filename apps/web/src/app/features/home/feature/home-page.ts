import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CatalogService } from '../../catalog/data-access/catalog.service';

interface CategoryTeaser {
  id: string;
  name: string;
  startingFromXof: number | null;
}

// Public, prerendered, zero API calls on load from the visitor's browser --
// the catalog fetch below runs at build time (see docs/DETTE.md for the
// tradeoff this implies) so the free-tier API can still be completely
// asleep and this page still renders instantly (docs/ADR/0003).
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MoneyPipe],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly catalogService = inject(CatalogService);

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

  protected readonly categoryTeasers = computed<CategoryTeaser[]>(() => {
    const categories = this.lastGoodCatalog()?.categories ?? [];
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      startingFromXof: this.lowestPrice(category.services),
    }));
  });

  private lowestPrice(services: { prices: { amountXof: number }[] }[]): number | null {
    const amounts = services.flatMap((service) => service.prices.map((price) => price.amountXof));
    return amounts.length > 0 ? Math.min(...amounts) : null;
  }
}
