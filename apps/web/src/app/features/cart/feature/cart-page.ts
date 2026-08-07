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
import { AgenciesService } from '../data-access/agencies.service';
import { CartService } from '../data-access/cart.service';
import { SiteFooter } from '../../../shared/layout/site-footer';
import { SiteHeader } from '../../../shared/layout/site-header';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

type PickupType = 'HOME' | 'AGENCY';

const DEFAULT_ERROR = 'Une erreur est survenue. Réessayez.';

function extractErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    return typeof message === 'string' ? message : DEFAULT_ERROR;
  }
  return DEFAULT_ERROR;
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

  protected readonly cart = resource({ loader: () => this.cartService.getCart() });
  protected readonly agencies = resource({ loader: () => this.agenciesService.listAgencies() });

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
}
