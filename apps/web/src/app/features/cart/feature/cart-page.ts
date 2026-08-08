import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { computeOrderTotals } from '@lavenet/shared-domain';
import { CheckoutResponseDtoOutput } from '../../../core/api-client/models/checkout-response-dto-output';
import { AddressesService } from '../data-access/addresses.service';
import { AgenciesService } from '../data-access/agencies.service';
import { CartService } from '../data-access/cart.service';
import { SlotsService } from '../data-access/slots.service';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

type PickupType = 'HOME' | 'AGENCY';
type Order = CheckoutResponseDtoOutput['order'];

const DEFAULT_ERROR = 'Une erreur est survenue. Réessayez.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
}

// Abidjan is UTC+0 with no DST -- formatting in UTC is formatting in
// local time, and avoids the browser's own timezone silently shifting the
// displayed hour for a visitor outside Abidjan.
const SLOT_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const SLOT_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

function formatSlotLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${SLOT_LABEL_FORMAT.format(start)}, ${SLOT_TIME_FORMAT.format(start)} - ${SLOT_TIME_FORMAT.format(end)}`;
}

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, SiteHeader, SiteFooter, MoneyPipe],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  private readonly cartService = inject(CartService);
  private readonly agenciesService = inject(AgenciesService);
  private readonly slotsService = inject(SlotsService);
  private readonly addressesService = inject(AddressesService);

  protected readonly cart = resource({ loader: () => this.cartService.getCart() });
  protected readonly agencies = resource({ loader: () => this.agenciesService.listAgencies() });
  protected readonly slots = resource({ loader: () => this.slotsService.listSlots() });
  protected readonly addresses = resource({ loader: () => this.addressesService.list() });
  protected readonly formatSlotLabel = formatSlotLabel;

  protected readonly updatingItemId = signal<string | null>(null);
  protected readonly removingItemId = signal<string | null>(null);
  protected readonly clearing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  // F-CMD-03. Local editable choice, seeded once from the saved cart (see
  // the effect below) and never overwritten again after that -- editing
  // must not be clobbered by a background reload triggered by an unrelated
  // action (e.g. removing an item).
  protected readonly pickupTypeChoice = signal<PickupType | null>(null);
  protected readonly selectedAgencyId = signal<string | null>(null);
  protected readonly selectedDropoffDate = signal<string>('');
  protected readonly savingPickup = signal(false);
  protected readonly pickupError = signal<string | null>(null);
  protected readonly minDropoffDate = new Date().toISOString().slice(0, 10);

  // F-CMD-04. Same "seed once from the saved cart, never overwritten
  // again" reasoning as the pickup-mode signals above.
  protected readonly selectedPickupSlotId = signal<string | null>(null);
  protected readonly selectedDeliverySlotId = signal<string | null>(null);
  protected readonly savingSlots = signal(false);
  protected readonly slotsError = signal<string | null>(null);

  // F-CMD-05. Same "seed once from the saved cart" pattern as pickup mode
  // and slots above.
  protected readonly selectedAddressId = signal<string | null>(null);
  protected readonly savingAddress = signal(false);
  protected readonly addressError = signal<string | null>(null);

  // F-CMD-05/07. checkoutResult holds the validated order once POST
  // /cart/checkout succeeds -- the template switches to a confirmation
  // view instead of the (now empty, DRAFT gone) cart when it's set.
  protected readonly checkingOut = signal(false);
  protected readonly checkoutError = signal<string | null>(null);
  protected readonly checkoutResult = signal<Order | null>(null);

  constructor() {
    effect(() => {
      if (!this.cart.hasValue()) {
        return;
      }
      const data = this.cart.value().cart;
      if (this.pickupTypeChoice() === null && data.pickupType !== null) {
        this.pickupTypeChoice.set(data.pickupType);
      }
      if (this.selectedAgencyId() === null && data.agencyId !== null) {
        this.selectedAgencyId.set(data.agencyId);
      }
      if (this.selectedDropoffDate() === '' && data.agencyDropoffDate !== null) {
        this.selectedDropoffDate.set(data.agencyDropoffDate);
      }
      if (this.selectedPickupSlotId() === null && data.pickupSlotId !== null) {
        this.selectedPickupSlotId.set(data.pickupSlotId);
      }
      if (this.selectedDeliverySlotId() === null && data.deliverySlotId !== null) {
        this.selectedDeliverySlotId.set(data.deliverySlotId);
      }
      if (this.selectedAddressId() === null && data.deliveryAddressId !== null) {
        this.selectedAddressId.set(data.deliveryAddressId);
      }
    });
  }

  protected readonly selectedAgency = computed(() => {
    if (!this.agencies.hasValue()) {
      return null;
    }
    const id = this.selectedAgencyId();
    return this.agencies.value().agencies.find((agency) => agency.id === id) ?? null;
  });

  protected readonly canSavePickup = computed(() => {
    const type = this.pickupTypeChoice();
    if (type === 'HOME') {
      return true;
    }
    if (type === 'AGENCY') {
      return this.selectedAgencyId() !== null && this.selectedDropoffDate() !== '';
    }
    return false;
  });

  // Gated on the *saved* pickup type (cart.value(), not the possibly-
  // unsaved pickupTypeChoice): PATCH /cart/slots requires a pickup mode
  // already persisted server-side.
  protected readonly savedPickupType = computed<PickupType | null>(() =>
    this.cart.hasValue() ? this.cart.value().cart.pickupType : null,
  );

  protected readonly canSaveSlots = computed(() => {
    const pickupType = this.savedPickupType();
    if (pickupType === null) {
      return false;
    }
    if (pickupType === 'HOME' && this.selectedPickupSlotId() === null) {
      return false;
    }
    return this.selectedDeliverySlotId() !== null;
  });

  protected readonly selectedAddress = computed(() => {
    if (!this.addresses.hasValue()) {
      return null;
    }
    const id = this.selectedAddressId();
    return this.addresses.value().addresses.find((address) => address.id === id) ?? null;
  });

  protected readonly canSaveAddress = computed(() => this.selectedAddressId() !== null);

  // F-CMD-05. Preview of the recap ("sous-total, remise, frais de
  // livraison, total TTC", CAHIER-DES-CHARGES.md §5.3) shown before
  // validation -- computeOrderTotals only needs a subtotal and a
  // quantity, so a single synthetic line reproduces the exact same figures
  // the API will freeze at checkout, without duplicating the delivery-fee
  // threshold logic here. Null when there's nothing meaningful to preview
  // (empty cart or a line whose pricing became unavailable).
  protected readonly totalsPreview = computed(() => {
    if (!this.cart.hasValue()) {
      return null;
    }
    const data = this.cart.value().cart;
    if (data.hasUnavailablePricing || data.subtotalXof === null || data.items.length === 0) {
      return null;
    }
    return computeOrderTotals([{ unitPriceXof: data.subtotalXof, quantity: 1 }]);
  });

  // Gated on *saved* state only (never the possibly-unsaved local
  // choices): checkout validates the same preconditions server-side
  // regardless, but disabling the button early avoids a guaranteed-400
  // round trip for an obviously incomplete cart.
  protected readonly canCheckout = computed(() => {
    if (!this.cart.hasValue()) {
      return false;
    }
    const data = this.cart.value().cart;
    if (data.items.length === 0 || data.hasUnavailablePricing) {
      return false;
    }
    if (
      data.pickupType === null ||
      data.deliverySlotId === null ||
      data.deliveryAddressId === null
    ) {
      return false;
    }
    return data.pickupType === 'AGENCY' || data.pickupSlotId !== null;
  });

  protected async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) {
      return;
    }
    this.updatingItemId.set(itemId);
    this.actionError.set(null);
    try {
      await this.cartService.updateItem(itemId, { quantity });
      this.cart.reload();
    } catch (err) {
      this.actionError.set(extractErrorMessage(err));
    } finally {
      this.updatingItemId.set(null);
    }
  }

  protected async removeItem(itemId: string): Promise<void> {
    this.removingItemId.set(itemId);
    this.actionError.set(null);
    try {
      await this.cartService.removeItem(itemId);
      this.cart.reload();
    } catch (err) {
      this.actionError.set(extractErrorMessage(err));
    } finally {
      this.removingItemId.set(null);
    }
  }

  protected async clearCart(): Promise<void> {
    this.clearing.set(true);
    this.actionError.set(null);
    try {
      await this.cartService.clearCart();
      this.cart.reload();
    } catch (err) {
      this.actionError.set(extractErrorMessage(err));
    } finally {
      this.clearing.set(false);
    }
  }

  protected choosePickupType(type: PickupType): void {
    this.pickupTypeChoice.set(type);
  }

  protected chooseAgency(agencyId: string): void {
    this.selectedAgencyId.set(agencyId || null);
  }

  protected chooseDropoffDate(date: string): void {
    this.selectedDropoffDate.set(date);
  }

  protected async savePickupMode(): Promise<void> {
    const pickupType = this.pickupTypeChoice();
    if (!pickupType || !this.canSavePickup()) {
      return;
    }
    this.savingPickup.set(true);
    this.pickupError.set(null);
    try {
      if (pickupType === 'HOME') {
        await this.cartService.setPickupMode({ pickupType: 'HOME' });
      } else {
        // canSavePickup() guarantees both are non-null/non-empty here.
        const agencyId = this.selectedAgencyId() as string;
        const agencyDropoffDate = this.selectedDropoffDate();
        await this.cartService.setPickupMode({ pickupType: 'AGENCY', agencyId, agencyDropoffDate });
      }
      this.cart.reload();
    } catch (err) {
      this.pickupError.set(extractErrorMessage(err));
    } finally {
      this.savingPickup.set(false);
    }
  }

  protected choosePickupSlot(slotId: string): void {
    this.selectedPickupSlotId.set(slotId || null);
  }

  protected chooseDeliverySlot(slotId: string): void {
    this.selectedDeliverySlotId.set(slotId || null);
  }

  protected async saveSlots(): Promise<void> {
    if (!this.canSaveSlots()) {
      return;
    }
    this.savingSlots.set(true);
    this.slotsError.set(null);
    try {
      // canSaveSlots() guarantees deliverySlotId is set, and pickupSlotId
      // too whenever the saved pickup mode is HOME.
      const deliverySlotId = this.selectedDeliverySlotId() as string;
      if (this.savedPickupType() === 'HOME') {
        const pickupSlotId = this.selectedPickupSlotId() as string;
        await this.cartService.setSlots({ pickupSlotId, deliverySlotId });
      } else {
        await this.cartService.setSlots({ deliverySlotId });
      }
      this.cart.reload();
    } catch (err) {
      this.slotsError.set(extractErrorMessage(err));
    } finally {
      this.savingSlots.set(false);
    }
  }

  protected chooseAddress(addressId: string): void {
    this.selectedAddressId.set(addressId || null);
  }

  protected async saveAddress(): Promise<void> {
    const addressId = this.selectedAddressId();
    if (!addressId || !this.canSaveAddress()) {
      return;
    }
    this.savingAddress.set(true);
    this.addressError.set(null);
    try {
      await this.cartService.setDeliveryAddress({ addressId });
      this.cart.reload();
    } catch (err) {
      this.addressError.set(extractErrorMessage(err));
    } finally {
      this.savingAddress.set(false);
    }
  }

  protected async checkout(): Promise<void> {
    if (!this.canCheckout()) {
      return;
    }
    this.checkingOut.set(true);
    this.checkoutError.set(null);
    try {
      const { order } = await this.cartService.checkout();
      this.checkoutResult.set(order);
      this.cart.reload();
    } catch (err) {
      this.checkoutError.set(extractErrorMessage(err));
    } finally {
      this.checkingOut.set(false);
    }
  }
}
