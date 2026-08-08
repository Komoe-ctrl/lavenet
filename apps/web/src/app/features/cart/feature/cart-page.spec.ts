import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AgenciesResponseDtoOutput } from '../../../core/api-client/models/agencies-response-dto-output';
import { CartResponseDtoOutput } from '../../../core/api-client/models/cart-response-dto-output';
import { SlotsResponseDtoOutput } from '../../../core/api-client/models/slots-response-dto-output';
import { SessionStore } from '../../../core/auth/session.store';
import { AgenciesService } from '../data-access/agencies.service';
import { CartService } from '../data-access/cart.service';
import { SlotsService } from '../data-access/slots.service';
import { CartPage } from './cart-page';

const EMPTY_CART: CartResponseDtoOutput = {
  cart: {
    id: null,
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
    pickupType: null,
    agencyId: null,
    agencyDropoffDate: null,
    pickupSlotId: null,
    deliverySlotId: null,
  },
};

const AGENCIES: AgenciesResponseDtoOutput = {
  agencies: [
    {
      id: 'agy_1',
      name: 'LaveNet Cocody',
      address: 'Cocody, Angré, Abidjan',
      openingHours: 'Lundi - Samedi, 8h - 18h',
    },
  ],
};

const SLOTS: SlotsResponseDtoOutput = {
  slots: [
    {
      id: 'slot_1',
      date: '2026-08-10',
      startsAt: '2026-08-10T08:00:00.000Z',
      endsAt: '2026-08-10T10:00:00.000Z',
      capacity: 5,
      seatsAvailable: 5,
    },
    {
      id: 'slot_2',
      date: '2026-08-13',
      startsAt: '2026-08-13T08:00:00.000Z',
      endsAt: '2026-08-13T10:00:00.000Z',
      capacity: 5,
      seatsAvailable: 5,
    },
  ],
};

type FakeCartService = {
  getCart: () => Promise<CartResponseDtoOutput>;
  updateItem: (id: string, body: unknown) => Promise<CartResponseDtoOutput>;
  removeItem: (id: string) => Promise<CartResponseDtoOutput>;
  clearCart: () => Promise<CartResponseDtoOutput>;
  setPickupMode: (body: unknown) => Promise<CartResponseDtoOutput>;
  setSlots: (body: unknown) => Promise<CartResponseDtoOutput>;
};

type FakeAgenciesService = {
  listAgencies: () => Promise<AgenciesResponseDtoOutput>;
};

type FakeSlotsService = {
  listSlots: () => Promise<SlotsResponseDtoOutput>;
};

// SiteHeader (rendered by CartPage) reads isAuthenticated()/user() -- a
// user viewing their cart is always logged in already (route is guarded).
function configureWith(
  service: Partial<FakeCartService>,
  agenciesService: Partial<FakeAgenciesService> = {},
  slotsService: Partial<FakeSlotsService> = {},
) {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: CartService,
        useValue: {
          getCart: vi.fn().mockResolvedValue(EMPTY_CART),
          updateItem: vi.fn(),
          removeItem: vi.fn(),
          clearCart: vi.fn(),
          setPickupMode: vi.fn(),
          setSlots: vi.fn(),
          ...service,
        },
      },
      {
        provide: AgenciesService,
        useValue: {
          listAgencies: vi.fn().mockResolvedValue(AGENCIES),
          ...agenciesService,
        },
      },
      {
        provide: SlotsService,
        useValue: {
          listSlots: vi.fn().mockResolvedValue(SLOTS),
          ...slotsService,
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
    configureWith({ getCart: () => Promise.resolve(EMPTY_CART) });
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
    const afterRemoval: CartResponseDtoOutput = {
      cart: {
        id: 'ord_1',
        items: [CART_WITH_ITEMS.cart.items[1]],
        subtotalXof: 500,
        hasUnavailablePricing: false,
        pickupType: null,
        agencyId: null,
        agencyDropoffDate: null,
        pickupSlotId: null,
        deliverySlotId: null,
      },
    };
    const removeItem = vi.fn().mockResolvedValue(afterRemoval);
    const getCart = vi
      .fn()
      .mockResolvedValueOnce(CART_WITH_ITEMS)
      .mockResolvedValueOnce(afterRemoval);
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
    const afterClearing: CartResponseDtoOutput = {
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
    const clearCart = vi.fn().mockResolvedValue(afterClearing);
    const getCart = vi
      .fn()
      .mockResolvedValueOnce(CART_WITH_ITEMS)
      .mockResolvedValueOnce(afterClearing);
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
            pickupType: null,
            agencyId: null,
            agencyDropoffDate: null,
            pickupSlotId: null,
            deliverySlotId: null,
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

  describe('pickup mode (F-CMD-03)', () => {
    it('saves HOME pickup with no agency fields', async () => {
      const setPickupMode = vi.fn().mockResolvedValue(CART_WITH_ITEMS);
      configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS), setPickupMode });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [homeRadio]: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
        '.pickup-mode__option input',
      );
      homeRadio.click();
      homeRadio.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      const saveButton: HTMLButtonElement =
        fixture.nativeElement.querySelector('.pickup-mode__save');
      expect(saveButton.disabled).toBe(false);
      saveButton.click();
      await fixture.whenStable();

      expect(setPickupMode).toHaveBeenCalledWith({ pickupType: 'HOME' });
    });

    it('reveals the agency picker, date field and opening hours only after choosing AGENCY', async () => {
      configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS) });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.pickup-mode__field select')).toBeNull();

      const [, agencyRadio]: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
        '.pickup-mode__option input',
      );
      agencyRadio.click();
      agencyRadio.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector(
        '.pickup-mode__field select',
      );
      expect(select).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('LaveNet Cocody');

      select.value = 'agy_1';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('Lundi - Samedi, 8h - 18h');
    });

    it('keeps the save button disabled for AGENCY until an agency and a date are both chosen', async () => {
      configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS) });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [, agencyRadio]: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
        '.pickup-mode__option input',
      );
      agencyRadio.click();
      agencyRadio.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      const saveButton: HTMLButtonElement =
        fixture.nativeElement.querySelector('.pickup-mode__save');
      expect(saveButton.disabled).toBe(true);

      const select: HTMLSelectElement = fixture.nativeElement.querySelector(
        '.pickup-mode__field select',
      );
      select.value = 'agy_1';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(saveButton.disabled).toBe(true);

      const dateInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '.pickup-mode__field input[type="date"]',
      );
      dateInput.value = '2026-08-10';
      dateInput.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(saveButton.disabled).toBe(false);
    });

    it('saves AGENCY pickup with the chosen agency and date', async () => {
      const setPickupMode = vi.fn().mockResolvedValue(CART_WITH_ITEMS);
      configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS), setPickupMode });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [, agencyRadio]: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
        '.pickup-mode__option input',
      );
      agencyRadio.click();
      agencyRadio.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector(
        '.pickup-mode__field select',
      );
      select.value = 'agy_1';
      select.dispatchEvent(new Event('change'));
      const dateInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '.pickup-mode__field input[type="date"]',
      );
      dateInput.value = '2026-08-10';
      dateInput.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      fixture.nativeElement.querySelector('.pickup-mode__save').click();
      await fixture.whenStable();

      expect(setPickupMode).toHaveBeenCalledWith({
        pickupType: 'AGENCY',
        agencyId: 'agy_1',
        agencyDropoffDate: '2026-08-10',
      });
    });

    it('pre-selects the pickup mode already saved on the cart', async () => {
      configureWith({
        getCart: () =>
          Promise.resolve({
            cart: {
              ...CART_WITH_ITEMS.cart,
              pickupType: 'AGENCY',
              agencyId: 'agy_1',
              agencyDropoffDate: '2026-08-10',
            },
          }),
      });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [, agencyRadio]: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
        '.pickup-mode__option input',
      );
      expect(agencyRadio.checked).toBe(true);
      const dateInput: HTMLInputElement = fixture.nativeElement.querySelector(
        '.pickup-mode__field input[type="date"]',
      );
      expect(dateInput.value).toBe('2026-08-10');
    });

    it('shows an inline error when saving the pickup mode fails', async () => {
      const setPickupMode = vi.fn(() =>
        Promise.reject(
          new HttpErrorResponse({ status: 400, error: { message: 'Agence introuvable.' } }),
        ),
      );
      configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS), setPickupMode });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [homeRadio]: HTMLInputElement[] = fixture.nativeElement.querySelectorAll(
        '.pickup-mode__option input',
      );
      homeRadio.click();
      homeRadio.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.nativeElement.querySelector('.pickup-mode__save').click();
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('Agence introuvable.');
    });
  });

  describe('slots (F-CMD-04)', () => {
    function cartWithPickup(pickupType: 'HOME' | 'AGENCY'): CartResponseDtoOutput {
      return {
        cart: {
          ...CART_WITH_ITEMS.cart,
          pickupType,
          agencyId: pickupType === 'AGENCY' ? 'agy_1' : null,
          agencyDropoffDate: pickupType === 'AGENCY' ? '2026-08-10' : null,
        },
      };
    }

    it('hides the slots section until a pickup mode is saved', async () => {
      configureWith({ getCart: () => Promise.resolve(CART_WITH_ITEMS) });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.slots-section')).toBeNull();
    });

    it('shows both a pickup-slot and a delivery-slot picker for HOME', async () => {
      configureWith({ getCart: () => Promise.resolve(cartWithPickup('HOME')) });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const selects = fixture.nativeElement.querySelectorAll('.slots-section__field select');
      expect(selects).toHaveLength(2);
      expect(fixture.nativeElement.textContent).toContain('Créneau de retrait');
      expect(fixture.nativeElement.textContent).toContain('Créneau de livraison');
    });

    it('shows only a delivery-slot picker for AGENCY', async () => {
      configureWith({ getCart: () => Promise.resolve(cartWithPickup('AGENCY')) });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const selects = fixture.nativeElement.querySelectorAll('.slots-section__field select');
      expect(selects).toHaveLength(1);
      expect(fixture.nativeElement.textContent).not.toContain('Créneau de retrait');
      expect(fixture.nativeElement.textContent).toContain('Créneau de livraison');
    });

    it('keeps the save button disabled for HOME until both slots are chosen', async () => {
      configureWith({ getCart: () => Promise.resolve(cartWithPickup('HOME')) });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const saveButton: HTMLButtonElement =
        fixture.nativeElement.querySelector('.slots-section__save');
      expect(saveButton.disabled).toBe(true);

      const [pickupSelect, deliverySelect]: HTMLSelectElement[] =
        fixture.nativeElement.querySelectorAll('.slots-section__field select');
      pickupSelect.value = 'slot_1';
      pickupSelect.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(saveButton.disabled).toBe(true);

      deliverySelect.value = 'slot_2';
      deliverySelect.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(saveButton.disabled).toBe(false);
    });

    it('saves HOME slots with both a pickup and a delivery slot id', async () => {
      const setSlots = vi.fn().mockResolvedValue(cartWithPickup('HOME'));
      configureWith({ getCart: () => Promise.resolve(cartWithPickup('HOME')), setSlots });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [pickupSelect, deliverySelect]: HTMLSelectElement[] =
        fixture.nativeElement.querySelectorAll('.slots-section__field select');
      pickupSelect.value = 'slot_1';
      pickupSelect.dispatchEvent(new Event('change'));
      deliverySelect.value = 'slot_2';
      deliverySelect.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      fixture.nativeElement.querySelector('.slots-section__save').click();
      await fixture.whenStable();

      expect(setSlots).toHaveBeenCalledWith({ pickupSlotId: 'slot_1', deliverySlotId: 'slot_2' });
    });

    it('saves AGENCY slots with just a delivery slot id', async () => {
      const setSlots = vi.fn().mockResolvedValue(cartWithPickup('AGENCY'));
      configureWith({ getCart: () => Promise.resolve(cartWithPickup('AGENCY')), setSlots });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [deliverySelect]: HTMLSelectElement[] = fixture.nativeElement.querySelectorAll(
        '.slots-section__field select',
      );
      deliverySelect.value = 'slot_2';
      deliverySelect.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      fixture.nativeElement.querySelector('.slots-section__save').click();
      await fixture.whenStable();

      expect(setSlots).toHaveBeenCalledWith({ deliverySlotId: 'slot_2' });
    });

    it('pre-selects the slots already saved on the cart', async () => {
      configureWith({
        getCart: () =>
          Promise.resolve({
            cart: {
              ...cartWithPickup('HOME').cart,
              pickupSlotId: 'slot_1',
              deliverySlotId: 'slot_2',
            },
          }),
      });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [pickupSelect, deliverySelect]: HTMLSelectElement[] =
        fixture.nativeElement.querySelectorAll('.slots-section__field select');
      expect(pickupSelect.value).toBe('slot_1');
      expect(deliverySelect.value).toBe('slot_2');

      const saveButton: HTMLButtonElement =
        fixture.nativeElement.querySelector('.slots-section__save');
      expect(saveButton.disabled).toBe(false);
    });

    it('shows an inline error when saving slots fails', async () => {
      const setSlots = vi.fn(() =>
        Promise.reject(
          new HttpErrorResponse({
            status: 400,
            error: {
              message:
                'Le créneau de livraison choisi est trop proche du retrait pour le temps de traitement requis.',
            },
          }),
        ),
      );
      configureWith({ getCart: () => Promise.resolve(cartWithPickup('AGENCY')), setSlots });
      const fixture = TestBed.createComponent(CartPage);
      fixture.detectChanges();
      await fixture.whenStable();

      const [deliverySelect]: HTMLSelectElement[] = fixture.nativeElement.querySelectorAll(
        '.slots-section__field select',
      );
      deliverySelect.value = 'slot_1';
      deliverySelect.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.nativeElement.querySelector('.slots-section__save').click();
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('trop proche du retrait');
    });
  });
});
