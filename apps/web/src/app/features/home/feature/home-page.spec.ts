import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import { HomePage } from './home-page';

const EXPECTED_PRICE = new MoneyPipe().transform(1200);

const SAMPLE_CATALOG: CatalogResponseDtoOutput = {
  categories: [
    {
      id: 'cat_1',
      slug: 'lavage',
      name: 'Lavage',
      position: 0,
      services: [
        {
          id: 'svc_1',
          slug: 'lavage-au-kilo',
          name: 'Lavage au kilo',
          unit: 'KG',
          processingHours: 24,
          prices: [{ articleTypeId: null, articleTypeName: null, amountXof: 1200 }],
        },
      ],
    },
  ],
};

function configureWith(catalogService: Pick<CatalogService, 'loadCatalog'>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: CatalogService, useValue: catalogService },
    ],
  });
}

describe('HomePage', () => {
  it('shows a loading state while services are being fetched', async () => {
    // A never-resolving loader never makes the resource stable, so this
    // can't await fixture.whenStable() -- just enough of a tick for the
    // resource's initial loading state to be reflected.
    configureWith({ loadCatalog: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chargement des services');
  });

  it('shows an error state when the catalog fetch fails', async () => {
    configureWith({ loadCatalog: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Services indisponibles');
  });

  it('shows an empty state when there are no categories', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucun service disponible');
  });

  it('renders a category teaser with the lowest price among its services', async () => {
    configureWith({ loadCatalog: () => Promise.resolve(SAMPLE_CATALOG) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage');
    expect(text).toContain(EXPECTED_PRICE);
  });
});
