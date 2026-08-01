import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { SessionStore } from '../../../core/auth/session.store';
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
      // SiteHeader reads this; on / it's always 'idle' in real usage (no
      // guard ever ran restore()) -- unauthenticated is the honest default.
      { provide: SessionStore, useValue: { isAuthenticated: () => false, user: () => null } },
    ],
  });
}

describe('HomePage', () => {
  it('shows the header, hero CTA and footer', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Le pressing en ligne pour Abidjan');
    expect(text).toContain('Voir nos tarifs');
    expect(text).toContain('projet de démonstration');
    expect(text).toContain('Dan Lefebvre (Unsplash)');
    const cta: HTMLAnchorElement = fixture.nativeElement.querySelector('.cta');
    expect(cta.getAttribute('href')).toBe('/tarifs');
  });

  // The hero used to promise "Commander" with no order tunnel behind it --
  // this guards against that regressing.
  it('never promises an order it cannot fulfil', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('Commander');
  });

  it('shows the delivery coverage, hours placeholder and FAQ', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Cocody');
    expect(text).toContain('Port-Bouët');
    expect(text).toContain('Horaires de collecte et de livraison');
    expect(text).toContain('Questions fréquentes');
    expect(text).toContain('Comment payer ma commande');
    // No invented figures: the copy must say these are still pending, not
    // state a fabricated fee/schedule as if it were real.
    expect(text).toContain('seront communiqués');
  });

  it('sets the page title and Open Graph tags', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();

    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    expect(title.getTitle()).toBe('LaveNet — Pressing en ligne à Abidjan');
    expect(meta.getTag('property="og:image"')?.content).toContain('/images/og-image.webp');
    expect(meta.getTag('property="og:url"')?.content).toMatch(/\/$/);
  });

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

  // Regression guard: resource() reruns its loader on the client after
  // hydration (see docs/DETTE.md). A background reload -- in flight or
  // failed -- must never blank out prices that were already correctly
  // displayed; loading/error states are for when there's nothing to show.
  it('keeps the last successful teasers on screen while a reload is in flight', async () => {
    let calls = 0;
    configureWith({
      loadCatalog: () => {
        calls++;
        return calls === 1 ? Promise.resolve(SAMPLE_CATALOG) : new Promise(() => undefined);
      },
    });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Lavage');

    (fixture.componentInstance as unknown as { catalog: { reload(): boolean } }).catalog.reload();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage');
    expect(text).toContain(EXPECTED_PRICE);
    expect(text).not.toContain('Chargement des services');
  });

  it('keeps the last successful teasers on screen when a reload fails', async () => {
    let calls = 0;
    configureWith({
      loadCatalog: () => {
        calls++;
        return calls === 1
          ? Promise.resolve(SAMPLE_CATALOG)
          : Promise.reject(new Error('network error'));
      },
    });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Lavage');

    (fixture.componentInstance as unknown as { catalog: { reload(): boolean } }).catalog.reload();
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage');
    expect(text).toContain(EXPECTED_PRICE);
    expect(text).not.toContain('Services indisponibles');
  });
});
