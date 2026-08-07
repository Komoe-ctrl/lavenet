import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CartResponseDtoOutput } from '../../../core/api-client/models/cart-response-dto-output';
import { SessionStore } from '../../../core/auth/session.store';
import { CartService } from '../data-access/cart.service';
import { CartPage } from './cart-page';

const CART_WITH_ITEMS: CartResponseDtoOutput = {
  cart: {
    id: 'ord_1',
    items: [
      {
        id: 'item_1',
        serviceId: 'svc_1',
        serviceSlug: 'lavage-au-kilo',
        serviceName: 'Lavage au kilo',
        unit: 'KG',
        articleTypeId: null,
        articleTypeName: null,
        quantity: 2,
        instructions: null,
        unitPriceXof: 1200,
        lineTotalXof: 2400,
      },
      {
        id: 'item_2',
        serviceId: 'svc_2',
        serviceSlug: 'repassage',
        serviceName: 'Repassage',
        unit: 'PIECE',
        articleTypeId: 'art_1',
        articleTypeName: 'Chemise',
        quantity: 1,
        instructions: 'Sans amidon',
        unitPriceXof: 500,
        lineTotalXof: 500,
      },
    ],
    subtotalXof: 2900,
    hasUnavailablePricing: false,
  },
};

type FakeCartService = {
  getCart: () => Promise<CartResponseDtoOutput>;
  updateItem: (id: string, body: unknown) => Promise<CartResponseDtoOutput>;
  removeItem: (id: string) => Promise<CartResponseDtoOutput>;
  clearCart: () => Promise<CartResponseDtoOutput>;
};

// SiteHeader (rendered by CartPage) reads isAuthenticated()/user() -- a
// user viewing their cart is always logged in already (route is guarded).
function configureWith(service: Partial<FakeCartService>) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: CartService,
        useValue: {
          getCart: vi.fn().mockResolvedValue({
            cart: { id: null, items: [], subtotalXof: 0, hasUnavailablePricing: false },
          }),
          updateItem: vi.fn(),
          removeItem: vi.fn(),
          clearCart: vi.fn(),
          ...service,
        },
      },
      { provide: SessionStore, useValue: { isAuthenticated: () => true, user: () => null } },
    ],
  });
}

describe('CartPage', () => {
  it('shows the header, footer and a loading state', async () => {
    configureWith({ getCart: () => new Promise(() => undefined) });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('LaveNet');
    expect(text).toContain('Mon panier');
    expect(text).toContain('Chargement de votre panier');
  });

  it('shows an empty state with a link back to /tarifs', async () => {
    configureWith({
      getCart: () =>
        Promise.resolve({
          cart: { id: null, items: [], subtotalXof: 0, hasUnavailablePricing: false },
        }),
    });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Votre panier est vide');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.back-link a');
    expect(link.getAttribute('href')).toBe('/tarifs');
  });

  it('shows an error state when the cart fails to load', async () => {
    configureWith({ getCart: () => Promise.reject(new Error('network error')) });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Impossible de charger votre panier');
  });

  it('lists items with quantity, instructions and the live subtotal', async () => {
    configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS) });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Lavage au kilo');
    expect(text).toContain('Repassage');
    expect(text).toContain('Chemise');
    expect(text).toContain('Sans amidon');
    const quantityInputs = fixture.nativeElement.querySelectorAll('.cart-item__quantity input');
    expect(quantityInputs[0].value).toBe('2');
  });

  it('updates the quantity and reloads the cart', async () => {
    const updateItem = vi.fn().mockResolvedValue(CART_WITH_ITEMS);
    const getCart = vi
      .fn()
      .mockResolvedValueOnce(CART_WITH_ITEMS)
      .mockResolvedValueOnce(CART_WITH_ITEMS);
    configureWith({ getCart, updateItem });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '.cart-item__quantity input',
    );
    input.value = '5';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(updateItem).toHaveBeenCalledWith('item_1', { quantity: 5 });
    expect(getCart).toHaveBeenCalledTimes(2);
  });

  it('removes an item', async () => {
    const removeItem = vi.fn().mockResolvedValue({
      cart: {
        id: 'ord_1',
        items: [CART_WITH_ITEMS.cart.items[1]],
        subtotalXof: 500,
        hasUnavailablePricing: false,
      },
    });
    const getCart = vi
      .fn()
      .mockResolvedValueOnce(CART_WITH_ITEMS)
      .mockResolvedValueOnce({
        cart: {
          id: 'ord_1',
          items: [CART_WITH_ITEMS.cart.items[1]],
          subtotalXof: 500,
          hasUnavailablePricing: false,
        },
      });
    configureWith({ getCart, removeItem });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const removeButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.cart-item__remove');
    removeButton.click();
    await fixture.whenStable();

    expect(removeItem).toHaveBeenCalledWith('item_1');
    expect(fixture.nativeElement.textContent).not.toContain('Lavage au kilo');
  });

  it('clears the whole cart', async () => {
    const clearCart = vi.fn().mockResolvedValue({
      cart: { id: 'ord_1', items: [], subtotalXof: 0, hasUnavailablePricing: false },
    });
    const getCart = vi
      .fn()
      .mockResolvedValueOnce(CART_WITH_ITEMS)
      .mockResolvedValueOnce({
        cart: { id: 'ord_1', items: [], subtotalXof: 0, hasUnavailablePricing: false },
      });
    configureWith({ getCart, clearCart });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const clearButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.cart-summary__clear');
    clearButton.click();
    await fixture.whenStable();

    expect(clearCart).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Votre panier est vide');
  });

  it('shows a warning instead of a subtotal when a line is unavailable', async () => {
    configureWith({
      getCart: () =>
        Promise.resolve({
          cart: {
            id: 'ord_1',
            items: [{ ...CART_WITH_ITEMS.cart.items[0], unitPriceXof: null, lineTotalXof: null }],
            subtotalXof: null,
            hasUnavailablePricing: true,
          },
        }),
    });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("n'est plus disponible");
    expect(text).toContain('ne sont plus disponibles');
  });

  it('shows an inline error when an action fails, without crashing', async () => {
    const removeItem = vi.fn(() =>
      Promise.reject(
        new HttpErrorResponse({
          status: 404,
          error: { message: 'Article du panier introuvable.' },
        }),
      ),
    );
    configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS), removeItem });
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const removeButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.cart-item__remove');
    removeButton.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Article du panier introuvable.');
  });
});
