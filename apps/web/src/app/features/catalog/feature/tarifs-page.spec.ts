import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { CartResponseDtoOutput } from '../../../core/api-client/models/cart-response-dto-output';
import { CatalogResponseDtoOutput } from '../../../core/api-client/models/catalog-response-dto-output';
import { CartService } from '../../cart/data-access/cart.service';
import { SessionStore } from '../../../core/auth/session.store';
import { siteConfig } from '../../../shared/config/site-config';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { CatalogService } from '../data-access/catalog.service';
import { TarifsPage } from './tarifs-page';

// Built through the real pipe rather than typed as a literal: fr-FR groups
// thousands with a narrow no-break space (U+202F), not a regular one, and a
// hand-typed literal silently normalizes to the wrong character.
const EXPECTED_PRICE = new MoneyPipe().transform(1200);

const EMPTY_CART: CartResponseDtoOutput = {
  cart: {
    id: 'ord_1',
    items: [],
    subtotalXof: 0,
    hasUnavailablePricing: false,
    pickupType: null,
    agencyId: null,
    agencyDropoffDate: null,
    pickupSlotId: null,
    deliverySlotId: null,
  },
};

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

type SessionOverrides = Partial<{
  isAuthenticated: () => boolean;
  user: () => null;
  status: () => 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  restore: () => Promise<void>;
}>;

function configureWith(
  catalogService: Pick<CatalogService, 'loadCatalog'>,
  overrides: { session?: SessionOverrides; cart?: Partial<Pick<CartService, 'addItem'>> } = {},
) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: 'login', children: [] }]),
      { provide: CatalogService, useValue: catalogService },
      {
        provide: SessionStore,
        useValue: {
          // SiteHeader reads this too; on /tarifs it's always 'idle' in
          // real usage (no guard ever ran restore()) -- unauthenticated is
          // the honest default.
          isAuthenticated: () => false,
          user: () => null,
          status: () => 'idle',
          restore: vi.fn(() => Promise.resolve()),
          ...overrides.session,
        },
      },
      {
        provide: CartService,
        useValue: { addItem: vi.fn(() => Promise.resolve(EMPTY_CART)), ...overrides.cart },
      },
    ],
  });
}

describe('TarifsPage', () => {
  it('shows the header and footer', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('projet de démonstration');
  });

  it('shows the development notice and real delivery figures from the centralized business config', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('en cours de développement');
    // Sourced from shared/config/site-config.ts, itself derived from
    // libs/shared/domain/business-config.ts (docs/ADR/0006) -- not a
    // placeholder, and not redeclared here as a literal amount.
    expect(text).toContain(siteConfig.delivery.feeNote);
    expect(text).toContain(siteConfig.delivery.minimumOrderNote);
  });

  it('sets the page title and Open Graph tags', async () => {
    configureWith({ loadCatalog: () => Promise.resolve({ categories: [] }) });
    const fixture = TestBed.createComponent(TarifsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    expect(title.getTitle()).toBe('Nos tarifs — LaveNet');
    expect(meta.getTag('property="og:url"')?.content).toMatch(/\/tarifs$/);
  });

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
    // "Tarif de base" duplicated the unit badge ("au kilo") shown right
    // above it -- replaced with a plain, non-redundant label.
    expect(text).toContain('Prix');
    expect(text).not.toContain('Tarif de base');
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

  describe('add to cart', () => {
    function renderWithCatalog(overrides?: Parameters<typeof configureWith>[1]) {
      configureWith({ loadCatalog: () => Promise.resolve(SAMPLE_CATALOG) }, overrides);
      const fixture = TestBed.createComponent(TarifsPage);
      fixture.detectChanges();
      return fixture;
    }

    it('sends to /login instead of adding, when the visitor turns out unauthenticated', async () => {
      const addItem = vi.fn();
      const restore = vi.fn(() => Promise.resolve());
      const fixture = renderWithCatalog({
        session: { isAuthenticated: () => false, status: () => 'idle', restore },
        cart: { addItem },
      });
      await fixture.whenStable();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.add-to-cart button');
      button.click();
      await fixture.whenStable();

      // /tarifs never restores on its own -- only a deliberate click does.
      expect(restore).toHaveBeenCalled();
      expect(addItem).not.toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    });

    it('adds the item without calling restore when the session is already known authenticated', async () => {
      const addItem = vi.fn(() => Promise.resolve(EMPTY_CART));
      const restore = vi.fn(() => Promise.resolve());
      const fixture = renderWithCatalog({
        session: { isAuthenticated: () => true, status: () => 'authenticated', restore },
        cart: { addItem },
      });
      await fixture.whenStable();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.add-to-cart button');
      button.click();
      await fixture.whenStable();

      expect(restore).not.toHaveBeenCalled();
      expect(addItem).toHaveBeenCalledWith({
        serviceId: 'svc_1',
        articleTypeId: undefined,
        quantity: 1,
      });
      expect(fixture.nativeElement.textContent).toContain('Ajouté');
    });

    it('sends the quantity typed in the field, not always 1', async () => {
      const addItem = vi.fn(() => Promise.resolve(EMPTY_CART));
      const fixture = renderWithCatalog({
        session: { isAuthenticated: () => true, status: () => 'authenticated' },
        cart: { addItem },
      });
      await fixture.whenStable();

      const input: HTMLInputElement = fixture.nativeElement.querySelector('.add-to-cart input');
      input.value = '3';
      input.dispatchEvent(new Event('input'));
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.add-to-cart button');
      button.click();
      await fixture.whenStable();

      expect(addItem).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: 'svc_1', quantity: 3 }),
      );
    });

    it('shows an inline error and never navigates away when adding fails', async () => {
      const addItem = vi.fn(() =>
        Promise.reject(
          new HttpErrorResponse({
            status: 400,
            error: {
              message: "Aucun tarif actif pour cette combinaison service / type d'article.",
            },
          }),
        ),
      );
      const fixture = renderWithCatalog({
        session: { isAuthenticated: () => true, status: () => 'authenticated' },
        cart: { addItem },
      });
      await fixture.whenStable();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.add-to-cart button');
      button.click();
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain(
        "Aucun tarif actif pour cette combinaison service / type d'article.",
      );
    });
  });
});
