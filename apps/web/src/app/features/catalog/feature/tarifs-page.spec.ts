import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CatalogService } from '../data-access/catalog.service';
import { TarifsPage } from './tarifs-page';

// Built through the real pipe rather than typed as a literal: fr-FR groups
// thousands with a narrow no-break space (U+202F), not a regular one, and a
// hand-typed literal silently normalizes to the wrong character.
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
      { provide: CatalogService, useValue: catalogService },
    ],
  });
}

describe('TarifsPage', () => {
  it('shows a loading state while the catalog is being fetched', async () => {
    // A never-resolving loader never makes the resource stable, so this
    // can't await fixture.whenStable() -- just enough of a tick for the
    // resource's initial loading state to be reflected.
    configureWith({ loadCatalog: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chargement des tarifs');
  });

  it('shows an error state when the catalog fetch fails', async () => {
    configureWith({ loadCatalog: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger les tarifs');
  });

  it('shows an empty state when there are no categories', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucun tarif disponible');
  });

  it('renders categories, services and formatted prices on success', async () => {
    configureWith({ loadCatalog: () => Promise.resolve(SAMPLE_CATALOG) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage');
    expect(text).toContain('Lavage au kilo');
    expect(text).toContain(EXPECTED_PRICE);
  });

  // Regression guard: resource() reruns its loader on the client after
  // hydration (see docs/DETTE.md). A background reload -- in flight or
  // failed -- must never blank out prices that were already correctly
  // displayed; loading/error states are for when there's nothing to show.
  it('keeps the last successful catalog on screen while a reload is in flight', async () => {
    let calls = 0;
    configureWith({
      loadCatalog: () => {
        calls++;
        return calls === 1 ? Promise.resolve(SAMPLE_CATALOG) : new Promise(() => undefined);
      },
    });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Lavage au kilo');

    (fixture.componentInstance as unknown as { catalog: { reload(): boolean } }).catalog.reload();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage au kilo');
    expect(text).toContain(EXPECTED_PRICE);
    expect(text).not.toContain('Chargement des tarifs');
  });

  it('keeps the last successful catalog on screen when a reload fails', async () => {
    let calls = 0;
    configureWith({
      loadCatalog: () => {
        calls++;
        return calls === 1
          ? Promise.resolve(SAMPLE_CATALOG)
          : Promise.reject(new Error('network error'));
      },
    });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Lavage au kilo');

    (fixture.componentInstance as unknown as { catalog: { reload(): boolean } }).catalog.reload();
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage au kilo');
    expect(text).toContain(EXPECTED_PRICE);
    expect(text).not.toContain('Impossible de charger les tarifs');
  });
});
